import { afterEach, describe, expect, it, vi } from "vitest";
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

    it("rejects with HTTP server error when port is already in use", async () => {
      const { server: existingServer } = await createServer();
      const usedPort = existingServer.port;

      const conflictServer = new WorkerServer({ port: usedPort });
      servers.push(conflictServer);
      await expect(conflictServer.start()).rejects.toMatchObject({
        code: "EADDRINUSE",
      });
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

    it("logs error when additional WebSocket endpoint server emits error", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { server } = await createServer({ logger });

      server.addWebSocketEndpoint("/ws/test-err", () => {});

      // Access the internal wss for the endpoint and emit error
      const serverAny = server as unknown as {
        additionalEndpoints: Map<
          string,
          { wss: { emit(event: string, ...args: unknown[]): void } }
        >;
      };
      const endpoint = serverAny.additionalEndpoints.get("/ws/test-err");
      endpoint?.wss.emit("error", new Error("endpoint wss error"));

      expect(logger.error).toHaveBeenCalledWith(
        "WebSocket server error",
        expect.objectContaining({ path: "/ws/test-err", error: "endpoint wss error" })
      );
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

    it("continues to next handler when current returns false", async () => {
      const { server, port } = await createServer();

      // First handler returns false (not handled)
      server.addHttpHandler(async () => false);
      // Second handler returns true (handled)
      server.addHttpHandler(async (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ handler: 2 }));
        return true;
      });

      const response = await fetch(`http://127.0.0.1:${port}/test`);
      expect(response.ok).toBe(true);
      const body = (await response.json()) as { handler: number };
      expect(body.handler).toBe(2);
    });

    it("swallows HTTP handler errors and continues", async () => {
      const { server, port } = await createServer();

      // First handler throws
      server.addHttpHandler(async () => {
        throw new Error("handler error");
      });
      // Second handler succeeds
      server.addHttpHandler(async (_req, res) => {
        res.writeHead(200);
        res.end("ok");
        return true;
      });

      const response = await fetch(`http://127.0.0.1:${port}/test`);
      expect(response.ok).toBe(true);
    });

    it("stringifies non-Error thrown by HTTP handler", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { server, port } = await createServer({ logger });

      server.addHttpHandler(async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "string-error";
      });

      await fetch(`http://127.0.0.1:${port}/test`).catch(() => {});

      expect(logger.error).toHaveBeenCalledWith(
        "HTTP handler error",
        expect.objectContaining({ error: "string-error" })
      );
    });
  });

  describe("broadcast", () => {
    it("broadcasts messages to all workers", async () => {
      const { server, port } = await createServer();

      const ws1 = await connectWorker(port);
      const ws2 = await connectWorker(port);
      sockets.push(ws1, ws2);

      sendRegistration(ws1, { workerId: "worker-1" });
      sendRegistration(ws2, { workerId: "worker-2" });
      await waitForMessage(ws1, (msg) => msg["type"] === "worker_registration_ack");
      await waitForMessage(ws2, (msg) => msg["type"] === "worker_registration_ack");

      const msg1 = waitForMessage<Record<string, unknown>>(
        ws1,
        (m) => m["type"] === "broadcast_test"
      );
      const msg2 = waitForMessage<Record<string, unknown>>(
        ws2,
        (m) => m["type"] === "broadcast_test"
      );

      server.broadcast({ type: "broadcast_test" });

      const r1 = await msg1;
      const r2 = await msg2;
      expect(r1["type"]).toBe("broadcast_test");
      expect(r2["type"]).toBe("broadcast_test");
    });
  });

  describe("health check (runHealthCheck)", () => {
    it("closes dead worker connections found by health check", async () => {
      const { server, port } = await createServer({
        heartbeatTimeoutMs: 10,
        healthCheckIntervalMs: 20,
      });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Wait long enough for health check to fire and detect dead worker
      // (heartbeatTimeoutMs=10, so after 30ms the worker is 3x timeout = dead)
      await new Promise((r) => setTimeout(r, 100));

      // Worker should have been closed and removed
      expect(server.listWorkers()).toHaveLength(0);
    });

    it("skips dead workers already removed from pool during health check", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { server } = await createServer({ logger });

      // Access internal pool and runHealthCheck directly
      const serverAny = server as unknown as {
        pool: {
          checkHealth(timeoutMs: number): string[];
          get(id: string): unknown;
        };
        runHealthCheck(): void;
        heartbeatTimeoutMs: number;
      };

      // Patch checkHealth to return a fake dead worker ID that isn't in the pool
      const origCheckHealth = serverAny.pool.checkHealth.bind(serverAny.pool);
      serverAny.pool.checkHealth = () => ["ghost-worker-id"];

      // Should not throw - the continue path is exercised
      expect(() => serverAny.runHealthCheck()).not.toThrow();

      // Restore
      serverAny.pool.checkHealth = origCheckHealth;

      // No warn should have been called for "ghost-worker-id" because it was skipped
      expect(logger.warn).not.toHaveBeenCalledWith(
        "Worker connection presumed dead, closing",
        expect.any(Object)
      );
    });
  });

  describe("onWorkerConnected / onWorkerDisconnected unsubscribe", () => {
    it("unsubscribe from onWorkerConnected stops receiving events", async () => {
      const { server, port } = await createServer();

      const connected: string[] = [];
      const unsubscribe = server.onWorkerConnected((worker) => {
        connected.push(worker.id);
      });

      const ws1 = await connectWorker(port);
      sockets.push(ws1);
      sendRegistration(ws1, { workerId: "worker-1" });
      await waitForMessage(ws1, (msg) => msg["type"] === "worker_registration_ack");

      expect(connected).toContain("worker-1");

      // Unsubscribe, then connect another worker
      unsubscribe();

      const ws2 = await connectWorker(port);
      sockets.push(ws2);
      sendRegistration(ws2, { workerId: "worker-2" });
      await waitForMessage(ws2, (msg) => msg["type"] === "worker_registration_ack");

      // worker-2 should NOT be in the list since we unsubscribed
      expect(connected).not.toContain("worker-2");
    });

    it("unsubscribe from onWorkerDisconnected stops receiving events", async () => {
      const { server, port } = await createServer();

      const disconnected: string[] = [];
      const unsubscribe = server.onWorkerDisconnected((worker) => {
        disconnected.push(worker.id);
      });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws, { workerId: "worker-1" });
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Unsubscribe before disconnecting
      unsubscribe();

      ws.close();
      await new Promise((r) => setTimeout(r, 50));

      expect(disconnected).not.toContain("worker-1");
    });
  });

  describe("onWorkerMessage unsubscribe", () => {
    it("unsubscribe from onWorkerMessage stops receiving events", async () => {
      const { server, port } = await createServer();

      const events: unknown[] = [];
      const unsubscribe = server.onWorkerMessage("test_msg", (event) => {
        events.push(event.message);
      });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Unsubscribe before sending
      unsubscribe();

      ws.send(JSON.stringify({ type: "test_msg" }));
      await new Promise((r) => setTimeout(r, 50));

      expect(events).toHaveLength(0);
    });
  });

  describe("WebSocket error handling", () => {
    it("logs Worker WebSocket server error when wss emits error", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { server } = await createServer({ logger });

      // Access internal workerWss via cast and emit a server-level error
      const serverAny = server as unknown as {
        workerWss: { emit(event: string, ...args: unknown[]): void } | null;
      };
      serverAny.workerWss?.emit("error", new Error("wss server error"));

      expect(logger.error).toHaveBeenCalledWith(
        "Worker WebSocket server error",
        expect.objectContaining({ error: "wss server error" })
      );
    });
  });

  describe("message routing edge cases", () => {
    it("handles invalid JSON from worker", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { server, port } = await createServer({ logger });
      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Send invalid JSON
      ws.send("not valid json");
      await new Promise((r) => setTimeout(r, 50));

      expect(logger.warn).toHaveBeenCalledWith(
        "Invalid JSON message from worker"
      );
    });

    it("handles message missing type field", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { server, port } = await createServer({ logger });
      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Send JSON without type field
      ws.send(JSON.stringify({ data: "no type here", type: 42 }));
      await new Promise((r) => setTimeout(r, 50));

      expect(logger.warn).toHaveBeenCalledWith("Message missing type field");
    });

    it("warns on unhandled message type from worker", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { server, port } = await createServer({ logger });
      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Send a message type with no registered handler
      ws.send(JSON.stringify({ type: "unknown_msg_type" }));
      await new Promise((r) => setTimeout(r, 50));

      expect(logger.warn).toHaveBeenCalledWith(
        "Unhandled message type from worker",
        expect.objectContaining({ type: "unknown_msg_type" })
      );
    });

    it("swallows errors thrown by message handlers", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { server, port } = await createServer({ logger });

      server.onWorkerMessage("error_msg", () => {
        throw new Error("handler boom");
      });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      ws.send(JSON.stringify({ type: "error_msg" }));
      await new Promise((r) => setTimeout(r, 50));

      expect(logger.error).toHaveBeenCalledWith(
        "Error in message handler",
        expect.objectContaining({ error: "handler boom" })
      );
    });
  });

  describe("heartbeat handling", () => {
    it("responds to heartbeat messages with heartbeat_ack", async () => {
      const { port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      ws.send(
        JSON.stringify({
          type: "heartbeat",
          workerId: "worker-1",
          timestamp: new Date().toISOString(),
        })
      );

      const ack = await waitForMessage<Record<string, unknown>>(
        ws,
        (msg) => msg["type"] === "heartbeat_ack"
      );
      expect(ack["type"]).toBe("heartbeat_ack");
      expect(ack["nextHeartbeatDeadline"]).toBeDefined();
    });

    it("warns when heartbeat comes from unknown worker", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { port } = await createServer({ logger });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Send heartbeat with non-existent workerId
      ws.send(
        JSON.stringify({
          type: "heartbeat",
          workerId: "nonexistent-worker",
          timestamp: new Date().toISOString(),
        })
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(logger.warn).toHaveBeenCalledWith(
        "Heartbeat from unknown worker",
        expect.objectContaining({ workerId: "nonexistent-worker" })
      );
    });

    it("restores unhealthy worker to available on heartbeat when not at capacity", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Mark worker as unhealthy
      const pool = (server as unknown as { pool: { get(id: string): { status: string; lastHeartbeat: Date; activeRequests: number; capabilities: { maxConcurrentRequests: number } } | undefined } }).pool;
      const worker = pool.get("worker-1");
      if (worker !== undefined) {
        (worker as { status: string }).status = "unhealthy";
      }

      // Send heartbeat to trigger recovery
      ws.send(
        JSON.stringify({
          type: "heartbeat",
          workerId: "worker-1",
          timestamp: new Date().toISOString(),
        })
      );

      await new Promise((r) => setTimeout(r, 50));

      const info = server.listWorkers()[0];
      expect(info?.status).toBe("available");
    });

    it("restores unhealthy busy worker to busy on heartbeat", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws, { maxConcurrentRequests: 1 });
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Dispatch to fill up the worker
      server.dispatch({
        message: { type: "work_request", requestId: "req-1" },
      });

      // Mark worker as unhealthy
      const pool = (server as unknown as { pool: { get(id: string): { status: string } | undefined } }).pool;
      const worker = pool.get("worker-1");
      if (worker !== undefined) {
        (worker as { status: string }).status = "unhealthy";
      }

      // Send heartbeat to trigger recovery - should become Busy (at capacity)
      ws.send(
        JSON.stringify({
          type: "heartbeat",
          workerId: "worker-1",
          timestamp: new Date().toISOString(),
        })
      );

      await new Promise((r) => setTimeout(r, 50));

      const info = server.listWorkers()[0];
      expect(info?.status).toBe("busy");
    });
  });

  describe("worker reconnection (replacing existing worker)", () => {
    it("replaces an existing worker connection with the same workerId", async () => {
      const { server, port } = await createServer();

      const ws1 = await connectWorker(port);
      sockets.push(ws1);
      sendRegistration(ws1, { workerId: "worker-1" });
      await waitForMessage(ws1, (msg) => msg["type"] === "worker_registration_ack");

      expect(server.listWorkers()).toHaveLength(1);

      // Connect a new WebSocket with the same workerId
      const ws2 = await connectWorker(port);
      sockets.push(ws2);
      sendRegistration(ws2, { workerId: "worker-1" });
      await waitForMessage(ws2, (msg) => msg["type"] === "worker_registration_ack");

      // Still only 1 worker after replacement
      expect(server.listWorkers()).toHaveLength(1);
    });

    it("fires disconnectedHandler when replacing worker with pending requests", async () => {
      const { server, port } = await createServer();

      const disconnectedWorkers: WorkerInfo[] = [];
      server.onWorkerDisconnected((worker) => {
        disconnectedWorkers.push(worker);
      });

      const ws1 = await connectWorker(port);
      sockets.push(ws1);
      sendRegistration(ws1, { workerId: "worker-1" });
      await waitForMessage(ws1, (msg) => msg["type"] === "worker_registration_ack");

      // Track a pending request
      server.dispatch({
        message: { type: "work_request", requestId: "req-1" },
      });

      // Reconnect with same workerId while there's a pending request
      const ws2 = await connectWorker(port);
      sockets.push(ws2);
      sendRegistration(ws2, { workerId: "worker-1" });
      await waitForMessage(ws2, (msg) => msg["type"] === "worker_registration_ack");

      await new Promise((r) => setTimeout(r, 50));

      // Should have fired disconnect for the replaced worker
      expect(disconnectedWorkers.length).toBeGreaterThan(0);
      expect(disconnectedWorkers[0]?.id).toBe("worker-1");
    });
  });

  describe("stop() edge cases", () => {
    it("stop() when server is not running is a no-op", async () => {
      const server = new WorkerServer({ port: getPort() });
      // Not started - stop should be a no-op
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe("resolveBoundPort fallback", () => {
    it("returns configuredPort when address is not an object", async () => {
      const port = getPort();
      const { server } = await createServer({ port });
      // Patch httpServer.address() to return a string (non-object)
      const serverAny = server as unknown as {
        httpServer: { address(): unknown } | null;
        configuredPort: number;
        resolveBoundPort(): number;
      };
      const originalAddress = serverAny.httpServer?.address.bind(
        serverAny.httpServer
      );
      if (serverAny.httpServer !== null && serverAny.httpServer !== undefined) {
        serverAny.httpServer.address = () => "pipe-path";
      }
      const resolved = serverAny.resolveBoundPort();
      expect(resolved).toBe(port);
      // Restore
      if (
        serverAny.httpServer !== null &&
        serverAny.httpServer !== undefined &&
        originalAddress !== undefined
      ) {
        serverAny.httpServer.address = originalAddress;
      }
    });
  });

  describe("unregistered WebSocket disconnect", () => {
    it("logs debug when unregistered WebSocket closes", async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { port } = await createServer({ logger });

      // Connect without registering
      const ws = await connectWorker(port);
      sockets.push(ws);

      // Close without registering (no workerId set)
      ws.close();
      await new Promise((r) => setTimeout(r, 50));

      expect(logger.debug).toHaveBeenCalledWith(
        "Unregistered WebSocket connection closed",
        expect.any(Object)
      );
    });
  });

  describe("connected/disconnected handler errors", () => {
    it("swallows errors thrown by onWorkerConnected handlers", async () => {
      const { server, port } = await createServer();

      server.onWorkerConnected(() => {
        throw new Error("connected handler boom");
      });

      const ws = await connectWorker(port);
      sockets.push(ws);

      // Should not throw even though handler throws
      sendRegistration(ws);
      const ack = await waitForMessage<Record<string, unknown>>(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );
      expect(ack["success"]).toBe(true);
    });

    it("swallows errors thrown by onWorkerDisconnected handlers", async () => {
      const { server, port } = await createServer();

      server.onWorkerDisconnected(() => {
        throw new Error("disconnected handler boom");
      });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(ws, (msg) => msg["type"] === "worker_registration_ack");

      // Close - should not throw
      ws.close();
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  describe("message from unregistered worker (unknownWorkerInfo)", () => {
    it("handles message from unregistered WebSocket connection", async () => {
      const { server, port } = await createServer();

      const events: unknown[] = [];
      server.onWorkerMessage("test_unregistered", (event) => {
        events.push(event.worker.id);
      });

      // Connect without registration
      const ws = await connectWorker(port);
      sockets.push(ws);

      // Send a message without registering (no workerId)
      ws.send(JSON.stringify({ type: "test_unregistered" }));
      await new Promise((r) => setTimeout(r, 50));

      // Event should be fired with unknownWorkerInfo
      expect(events).toHaveLength(1);
      expect(events[0]).toBe("unknown");
    });
  });
});
