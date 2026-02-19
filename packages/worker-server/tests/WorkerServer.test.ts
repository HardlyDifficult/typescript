import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";

import { WorkerServer, WorkerStatus } from "../src/index.js";

/** Connect a WebSocket client, send registration, and return the socket. */
async function connectWorker(
  port: number,
  options?: {
    workerId?: string;
    workerName?: string;
    authToken?: string;
    models?: string[];
    path?: string;
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
      capabilities: { models, maxConcurrentRequests: 2 },
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
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve(msg as T);
      }
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

  afterEach(async () => {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    sockets.length = 0;

    for (const s of servers) {
      await s.stop();
    }
    servers.length = 0;
  });

  async function createServer(
    overrides?: Partial<Parameters<typeof WorkerServer.prototype.start>[0]> & {
      authToken?: string;
    }
  ): Promise<{ server: WorkerServer; port: number }> {
    const port = getPort();
    const server = new WorkerServer({
      port,
      ...overrides,
    });
    servers.push(server);
    await server.start();
    return { server, port };
  }

  describe("start/stop lifecycle", () => {
    it("starts and stops cleanly", async () => {
      const { server } = await createServer();
      expect(server.getWorkerCount()).toBe(0);
      await server.stop();
    });

    it("rejects starting twice", async () => {
      const { server } = await createServer();
      await expect(server.start()).rejects.toThrow("already running");
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
      expect(server.getWorkerCount()).toBe(1);
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
      expect(server.getWorkerCount()).toBe(1);
    });
  });

  describe("message routing", () => {
    it("routes messages to registered handlers by type", async () => {
      const { server, port } = await createServer();

      const messagePromise = new Promise<Record<string, unknown>>((resolve) => {
        server.onWorkerMessage("work_complete", (_worker, msg) => {
          resolve(msg);
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

      const received = await messagePromise;
      expect(received["requestId"]).toBe("req-1");
    });
  });

  describe("send", () => {
    it("sends a message to a specific worker", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const msgPromise = waitForMessage<Record<string, unknown>>(
        ws,
        (msg) => msg["type"] === "work_request"
      );

      const sent = server.send("worker-1", {
        type: "work_request",
        requestId: "req-1",
      });
      expect(sent).toBe(true);

      const received = await msgPromise;
      expect(received["requestId"]).toBe("req-1");
    });

    it("returns false for unknown worker", async () => {
      const { server } = await createServer();
      expect(server.send("no-such-worker", { type: "test" })).toBe(false);
    });
  });

  describe("pool queries", () => {
    it("getAvailableWorker finds worker by model", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws, { models: ["sonnet"] });
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      const worker = server.getAvailableWorker("sonnet");
      expect(worker).not.toBeNull();
      expect(worker!.id).toBe("worker-1");

      expect(server.getAvailableWorker("other")).toBeNull();
    });

    it("getAnyAvailableWorker returns a worker", async () => {
      const { server, port } = await createServer();

      expect(server.getAnyAvailableWorker()).toBeNull();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      expect(server.getAnyAvailableWorker()).not.toBeNull();
    });
  });

  describe("request tracking", () => {
    it("tracks and releases requests", async () => {
      const { server, port } = await createServer();

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      server.trackRequest("worker-1", "req-1");
      let info = server.getWorkerInfo()[0];
      expect(info.activeRequests).toBe(1);
      expect(info.pendingRequestIds.has("req-1")).toBe(true);

      server.releaseRequest("req-1", { incrementCompleted: true });
      info = server.getWorkerInfo()[0];
      expect(info.activeRequests).toBe(0);
      expect(info.completedRequests).toBe(1);
    });
  });

  describe("disconnect", () => {
    it("emits disconnected event with pending request IDs", async () => {
      const { server, port } = await createServer();

      const disconnectPromise = new Promise<{
        workerId: string;
        pending: ReadonlySet<string>;
      }>((resolve) => {
        server.onWorkerDisconnected((worker, pendingRequestIds) => {
          resolve({ workerId: worker.id, pending: pendingRequestIds });
        });
      });

      const ws = await connectWorker(port);
      sockets.push(ws);
      sendRegistration(ws);
      await waitForMessage(
        ws,
        (msg) => msg["type"] === "worker_registration_ack"
      );

      server.trackRequest("worker-1", "req-1");
      ws.close();

      const result = await disconnectPromise;
      expect(result.workerId).toBe("worker-1");
      expect(result.pending.has("req-1")).toBe(true);
      expect(server.getWorkerCount()).toBe(0);
    });
  });

  describe("additional WebSocket endpoints", () => {
    it("routes connections on custom path", async () => {
      const { server, port } = await createServer();

      const dashboardConnected = new Promise<void>((resolve) => {
        server.addWebSocketEndpoint("/ws/dashboard", (_ws) => {
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
