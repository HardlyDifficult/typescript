import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import {
  WorkerServer,
  WorkerStatus,
  type WorkerServerOptions,
} from "../src/index.js";
import type { ConnectedWorker, WorkerInfo } from "../src/types.js";

/** Connect a WebSocket client, send registration, and return the socket. */
async function connectWorker(
  port: number,
  options?: {
    workerId?: string;
    workerName?: string;
    authToken?: string;
    models?: string[];
    path?: string;
    maxConcurrentRequests?: number;
    concurrencyLimits?: Record<string, number>;
  }
): Promise<WebSocket> {
  const path = options?.path ?? "/ws";
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return ws;
}

function sendRegistration(
  ws: WebSocket,
  options?: {
    workerId?: string;
    workerName?: string;
    authToken?: string;
    models?: string[];
    maxConcurrentRequests?: number;
    concurrencyLimits?: Record<string, number>;
  }
): void {
  const models = (options?.models ?? ["test-model"]).map((id) => ({
    modelId: id,
    displayName: id,
    maxContextTokens: 8192,
    maxOutputTokens: 4096,
    supportsStreaming: true,
  }));

  ws.send(
    JSON.stringify({
      type: "worker_registration",
      workerId: options?.workerId ?? "worker-1",
      workerName: options?.workerName ?? "Test Worker",
      capabilities: {
        models,
        maxConcurrentRequests: options?.maxConcurrentRequests ?? 2,
        ...(options?.concurrencyLimits !== undefined && {
          concurrencyLimits: options.concurrencyLimits,
        }),
      },
      ...(options?.authToken !== undefined && {
        authToken: options.authToken,
      }),
    })
  );
}

/** Wait for a message matching a predicate. */
async function waitForMessage<T>(
  ws: WebSocket,
  predicate: (msg: Record<string, unknown>) => boolean,
  timeoutMs = 2000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for message")),
      timeoutMs
    );

    ws.on("message", function handler(data: WebSocket.RawData) {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;
      if (!predicate(msg)) {
        return;
      }

      clearTimeout(timer);
      ws.off("message", handler);
      resolve(msg as T);
    });
  });
}

describe("WorkerServer", () => {
  const servers: WorkerServer[] = [];
  const sockets: WebSocket[] = [];
  let nextPort = 19_100;

  function getPort(): number {
    return nextPort++;
  }

  async function createServer(
    overrides: Partial<WorkerServerOptions> = {}
  ): Promise<{ server: WorkerServer; port: number }> {
    const server = new WorkerServer({
      port: overrides.port ?? getPort(),
      ...overrides,
    });
    servers.push(server);
    await server.start();
    return { server, port: server.port };
  }

  afterEach(async () => {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    sockets.length = 0;

    for (const server of servers) {
      await server.stop();
    }
    servers.length = 0;
  });

  describe("start/stop lifecycle", () => {
    it("starts and stops cleanly", async () => {
      const { server } = await createServer();
      expect(server.listWorkers()).toHaveLength(0);
      await server.stop();
    });

    it("rejects starting twice", async () => {
      const { server } = await createServer();
      await expect(server.start()).rejects.toThrow("already running");
    });

    it("exposes the bound port after starting on port 0", async () => {
      const { server } = await createServer({ port: 0 });
      expect(server.port).toBeGreaterThan(0);

      const response = await fetch(`http://127.0.0.1:${server.port}/unknown`);
      expect(response.status).toBe(404);
    });
  });

  describe("worker registration", () => {
    it("registers a worker and emits connected event", async () => {
      const { server, port } = await createServer();
      const connectedPromise = new Promise<void>((resolve) => {
        server.onWorkerConnected((worker) => {
          expect(worker.id).toBe("worker-1");
          expect(worker.name).toBe("Test Worker");
          expect(worker.status).toBe(WorkerStatus.Available);
          resolve();
        });
      });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);

      const ack = await waitForMessage<Record<string, unknown>>(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );
      expect(ack["success"]).toBe(true);
      expect(ack["sessionId"]).toBeDefined();

      await connectedPromise;
      expect(server.listWorkers()).toHaveLength(1);
    });

    it("rejects registration with invalid auth token", async () => {
      const { port } = await createServer({ authToken: "secret" });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws, { authToken: "wrong" });

      const ack = await waitForMessage<Record<string, unknown>>(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );
      expect(ack["success"]).toBe(false);
      expect(ack["error"]).toContain("authentication");
    });

    it("accepts registration with valid auth token", async () => {
      const { server, port } = await createServer({ authToken: "secret" });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws, { authToken: "secret" });

      const ack = await waitForMessage<Record<string, unknown>>(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );
      expect(ack["success"]).toBe(true);
      expect(server.listWorkers()).toHaveLength(1);
    });
  });

  describe("dispatch", () => {
    it("dispatches a message and tracks the request", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws, {
        models: ["sonnet"],
        concurrencyLimits: { local: 2 },
      });
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const workerMessage = waitForMessage<Record<string, unknown>>(
        ws,
        (msg) => msg["type"] === "work_request"
      );

      const dispatched = server.dispatch({
        model: "sonnet",
        category: "local",
        message: {
          type: "work_request",
          requestId: "req-1",
          input: "Process this data",
        },
      });

      expect(dispatched).not.toBeNull();
      expect(dispatched!.worker.id).toBe("worker-1");
      expect(dispatched!.worker.requests.active).toBe(1);
      expect(server.availableSlots("sonnet", "local")).toBe(1);

      const snapshot = server.listWorkers()[0];
      expect(snapshot.requests.pendingIds).toEqual(["req-1"]);
      expect(snapshot.requests.activeByCategory).toEqual({ local: 1 });

      const received = await workerMessage;
      expect(received["requestId"]).toBe("req-1");
    });

    it("returns null when there is no eligible worker", async () => {
      const { server } = await createServer();
      expect(
        server.dispatch({
          model: "sonnet",
          message: {
            type: "work_request",
            requestId: "req-1",
          },
        })
      ).toBeNull();
    });

    it("returns null when the category is at capacity", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws, {
        models: ["sonnet"],
        maxConcurrentRequests: 5,
        concurrencyLimits: { local: 1 },
      });
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const dispatched = server.dispatch({
        model: "sonnet",
        category: "local",
        message: {
          type: "work_request",
          requestId: "req-1",
        },
      });
      expect(dispatched).not.toBeNull();
      expect(server.availableSlots("sonnet", "local")).toBe(0);

      expect(
        server.dispatch({
          model: "sonnet",
          category: "local",
          message: {
            type: "work_request",
            requestId: "req-2",
          },
        })
      ).toBeNull();
    });

    it("retries another worker when the first send fails", async () => {
      const { server, port } = await createServer();

      const ws1 = await connectWorker(port);
      const ws2 = await connectWorker(port);
      sockets.push(ws1, ws2);

      sendRegistration(ws1, {
        workerId: "worker-1",
        workerName: "Worker 1",
        models: ["sonnet"],
      });
      sendRegistration(ws2, {
        workerId: "worker-2",
        workerName: "Worker 2",
        models: ["sonnet"],
      });

      await waitForMessage(
        ws1,
        (msg) => msg["type"] === "worker_registration_ack"
      );
      await waitForMessage(
        ws2,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const pool = (
        server as unknown as {
          pool: { get(id: string): ConnectedWorker | undefined };
        }
      ).pool;
      const firstWorker = pool.get("worker-1");
      if (firstWorker === undefined) {
        throw new Error("Expected first worker to exist");
      }

      (firstWorker.websocket as unknown as { send(): void }).send = () => {
        throw new Error("boom");
      };

      const worker2Message = waitForMessage<Record<string, unknown>>(
        ws2,
        (msg) => msg["type"] === "work_request"
      );

      const dispatched = server.dispatch({
        model: "sonnet",
        message: {
          type: "work_request",
          requestId: "req-1",
        },
      });

      expect(dispatched).not.toBeNull();
      expect(dispatched!.worker.id).toBe("worker-2");
      expect(server.listWorkers()[0].requests.pendingIds).toEqual([]);
      expect(server.listWorkers()[1].requests.pendingIds).toEqual(["req-1"]);

      const received = await worker2Message;
      expect(received["requestId"]).toBe("req-1");
    });

    it("complete() releases the request and increments completed count", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const dispatched = server.dispatch({
        message: {
          type: "work_request",
          requestId: "req-1",
        },
      });

      expect(dispatched).not.toBeNull();
      dispatched!.complete();
      dispatched!.complete();

      const worker = server.listWorkers()[0];
      expect(worker.requests.active).toBe(0);
      expect(worker.requests.completed).toBe(1);
    });

    it("fail() releases the request without incrementing completed count", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const dispatched = server.dispatch({
        message: {
          type: "work_request",
          requestId: "req-1",
        },
      });

      expect(dispatched).not.toBeNull();
      dispatched!.fail();
      dispatched!.fail();

      const worker = server.listWorkers()[0];
      expect(worker.requests.active).toBe(0);
      expect(worker.requests.completed).toBe(0);
    });
  });

  describe("message routing", () => {
    it("routes messages to registered handlers by type", async () => {
      const { server, port } = await createServer();

      const eventPromise = new Promise<{
        worker: WorkerInfo;
        requestId: string | null;
        response: string;
      }>((resolve) => {
        server.onWorkerMessage<{
          type: "work_complete";
          requestId: string;
          response: string;
        }>("work_complete", (event) => {
          resolve({
            worker: event.worker,
            requestId: event.requestId,
            response: String(event.message.response),
          });
        });
      });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      ws.send(
        JSON.stringify({
          type: "work_complete",
          requestId: "req-1",
          response: "done",
        })
      );

      const event = await eventPromise;
      expect(event.worker.id).toBe("worker-1");
      expect(event.requestId).toBe("req-1");
      expect(event.response).toBe("done");
    });

    it("event.complete() releases tracked requests", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const settled = new Promise<void>((resolve) => {
        server.onWorkerMessage("work_complete", (event) => {
          event.complete();
          event.complete();
          resolve();
        });
      });

      const dispatched = server.dispatch({
        message: {
          type: "work_request",
          requestId: "req-1",
        },
      });
      expect(dispatched).not.toBeNull();

      ws.send(
        JSON.stringify({
          type: "work_complete",
          requestId: "req-1",
        })
      );

      await settled;

      const worker = server.listWorkers()[0];
      expect(worker.requests.active).toBe(0);
      expect(worker.requests.completed).toBe(1);
    });

    it("event helpers are safe no-ops for untracked messages", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const eventPromise = new Promise<string | null>((resolve) => {
        server.onWorkerMessage("status_update", (event) => {
          event.complete();
          event.fail();
          resolve(event.requestId);
        });
      });

      ws.send(
        JSON.stringify({
          type: "status_update",
          status: "idle",
        })
      );

      expect(await eventPromise).toBeNull();

      const worker = server.listWorkers()[0];
      expect(worker.requests.active).toBe(0);
      expect(worker.requests.completed).toBe(0);
    });
  });

  describe("worker snapshots", () => {
    it("returns immutable snapshots that do not expose live Set/Map state", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws, {
        concurrencyLimits: { local: 2 },
      });
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const dispatched = server.dispatch({
        category: "local",
        message: {
          type: "work_request",
          requestId: "req-1",
        },
      });
      expect(dispatched).not.toBeNull();

      const worker = server.listWorkers()[0];
      expect(Array.isArray(worker.requests.pendingIds)).toBe(true);
      expect(worker.requests.activeByCategory).toEqual({ local: 1 });
      expect(
        "has" in
          (worker.requests.pendingIds as unknown as Record<string, unknown>)
      ).toBe(false);
      expect(worker.requests.activeByCategory instanceof Map).toBe(false);
      expect(() => {
        (worker.requests.pendingIds as string[]).push("extra");
      }).toThrow();
      expect(() => {
        (worker.requests.activeByCategory as Record<string, number>).local = 99;
      }).toThrow();

      const freshWorker = server.listWorkers()[0];
      expect(freshWorker.requests.pendingIds).toEqual(["req-1"]);
      expect(freshWorker.requests.activeByCategory).toEqual({ local: 1 });
    });
  });

  describe("disconnect", () => {
    it("emits disconnected events with pending request ids on the worker snapshot", async () => {
      const { server, port } = await createServer();

      const disconnected = new Promise<WorkerInfo>((resolve) => {
        server.onWorkerDisconnected((worker) => {
          resolve(worker);
        });
      });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const dispatched = server.dispatch({
        message: {
          type: "work_request",
          requestId: "req-1",
        },
      });
      expect(dispatched).not.toBeNull();

      ws.close();

      const worker = await disconnected;
      expect(worker.id).toBe("worker-1");
      expect(worker.requests.pendingIds).toEqual(["req-1"]);
      expect(server.listWorkers()).toHaveLength(0);
    });
  });

  describe("additional WebSocket endpoints", () => {
    it("routes connections on custom path", async () => {
      const { server, port } = await createServer();

      const dashboardConnected = new Promise<void>((resolve) => {
        server.addWebSocketEndpoint("/ws/dashboard", () => {
          resolve();
        });
      });

      const ws = await connectWorker(port, { path: "/ws/dashboard" });
      sockets.push(ws);

      await dashboardConnected;
    });
  });

  describe("HTTP handlers", () => {
    it("custom handler responds to HTTP requests", async () => {
      const { server, port } = await createServer();

      server.addHttpHandler(async (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return true;
      });

      const response = await fetch(`http://127.0.0.1:${port}/health`);
      expect(response.ok).toBe(true);
      const body = (await response.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    });

    it("returns 404 for unhandled HTTP requests", async () => {
      const { port } = await createServer();

      const response = await fetch(`http://127.0.0.1:${port}/unknown`);
      expect(response.status).toBe(404);
    });
  });
});
