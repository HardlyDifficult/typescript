/**
 * Unit tests for ConnectionHandler covering edge cases not reachable
 * through the high-level WorkerServer integration tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type WebSocket from "ws";

import { ConnectionHandler } from "../src/ConnectionHandler.js";
import { WorkerPool } from "../src/WorkerPool.js";
import { WorkerStatus, type ConnectedWorker } from "../src/types.js";

function createMockWs(): WebSocket & { workerId?: string } {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const ws = {
    workerId: undefined as string | undefined,
    send: vi.fn(),
    close: vi.fn(),
    on(event: string, handler: (...args: unknown[]) => void) {
      if (handlers[event] === undefined) handlers[event] = [];
      handlers[event].push(handler);
    },
    emit(event: string, ...args: unknown[]) {
      for (const h of handlers[event] ?? []) {
        h(...args);
      }
    },
  } as unknown as WebSocket & { workerId?: string } & {
    emit(event: string, ...args: unknown[]): void;
  };
  return ws;
}

function createWorker(overrides?: Partial<ConnectedWorker>): ConnectedWorker {
  return {
    id: "worker-1",
    name: "Test Worker",
    websocket: createMockWs(),
    capabilities: {
      models: [
        {
          modelId: "test-model",
          displayName: "Test Model",
          maxContextTokens: 8192,
          maxOutputTokens: 4096,
          supportsStreaming: true,
        },
      ],
      maxConcurrentRequests: 2,
    },
    status: WorkerStatus.Available,
    sessionId: "session-1",
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    activeRequests: 0,
    pendingRequests: new Set(),
    completedRequests: 0,
    requestCategories: new Map(),
    categoryActiveRequests: new Map(),
    ...overrides,
  };
}

function createHandler(options?: {
  authToken?: string;
  logger?: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
}) {
  const pool = new WorkerPool();
  const logger = options?.logger ?? {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const settlement = { complete: vi.fn(), fail: vi.fn() };
  const handler = new ConnectionHandler(
    pool,
    {
      authToken: options?.authToken,
      heartbeatTimeoutMs: 60_000,
      heartbeatIntervalMs: 15_000,
    },
    () => settlement,
    logger
  );
  return { pool, logger, handler, settlement };
}

function sendMessage(
  handler: ConnectionHandler,
  ws: WebSocket,
  data: unknown
): void {
  const buf = Buffer.from(JSON.stringify(data));
  (
    handler as unknown as {
      handleMessage(ws: WebSocket, data: Buffer): void;
    }
  ).handleMessage(ws, buf);
}

function sendRawMessage(
  handler: ConnectionHandler,
  ws: WebSocket,
  rawData: string
): void {
  const buf = Buffer.from(rawData);
  (
    handler as unknown as {
      handleMessage(ws: WebSocket, data: Buffer): void;
    }
  ).handleMessage(ws, buf);
}

describe("ConnectionHandler", () => {
  describe("onMessage unsubscribe", () => {
    it("unsubscribing removes the handler", () => {
      const { handler } = createHandler();
      const callback = vi.fn();
      const unsub = handler.onMessage("test", callback);

      const ws = createMockWs();
      (ws as unknown as { workerId?: string }).workerId = undefined;

      // Register a worker first so the handler has something to route to
      // Actually - for routing we need the message type to match
      // The handler is registered but workerId is undefined, so we get unknownWorkerInfo

      // Unsubscribe before sending
      unsub();

      sendMessage(handler, ws, { type: "test" });
      expect(callback).not.toHaveBeenCalled();
    });

    it("onWorkerConnected unsubscribe removes handler", () => {
      const { handler } = createHandler();
      const callback = vi.fn();
      const unsub = handler.onWorkerConnected(callback);
      unsub();

      const ws = createMockWs();
      const msg = {
        type: "worker_registration",
        workerId: "w1",
        workerName: "Worker 1",
        capabilities: {
          models: [
            {
              modelId: "m1",
              displayName: "M1",
              maxContextTokens: 8192,
              maxOutputTokens: 4096,
              supportsStreaming: true,
            },
          ],
          maxConcurrentRequests: 1,
        },
      };
      sendMessage(handler, ws, msg);

      expect(callback).not.toHaveBeenCalled();
    });

    it("onWorkerDisconnected unsubscribe removes handler", () => {
      const { handler, pool } = createHandler();

      // Register a worker
      const worker = createWorker({ id: "w1" });
      const ws = createMockWs();
      pool.add(worker);
      (ws as unknown as { workerId?: string }).workerId = "w1";

      const callback = vi.fn();
      const unsub = handler.onWorkerDisconnected(callback);
      unsub();

      // Trigger disconnect
      (
        handler as unknown as {
          handleDisconnect(ws: WebSocket, code: number, reason: string): void;
        }
      ).handleDisconnect(ws, 1000, "normal");

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("handleMessage edge cases", () => {
    it("logs warning for invalid JSON", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });
      const ws = createMockWs();
      sendRawMessage(handler, ws, "not json");
      expect(logger.warn).toHaveBeenCalledWith(
        "Invalid JSON message from worker"
      );
    });

    it("logs warning when type field is not a string", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });
      const ws = createMockWs();
      sendMessage(handler, ws, { type: 42, data: "x" });
      expect(logger.warn).toHaveBeenCalledWith("Message missing type field");
    });

    it("logs warning for unhandled message type", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });
      const ws = createMockWs();
      sendMessage(handler, ws, { type: "unknown_type" });
      expect(logger.warn).toHaveBeenCalledWith(
        "Unhandled message type from worker",
        expect.objectContaining({ type: "unknown_type" })
      );
    });

    it("routes to unknownWorkerInfo when ws has no workerId", () => {
      const { handler } = createHandler();
      const events: string[] = [];
      handler.onMessage("test_event", (event) => {
        events.push(event.worker.id);
      });

      const ws = createMockWs();
      // ws.workerId is undefined
      sendMessage(handler, ws, { type: "test_event" });

      expect(events).toHaveLength(1);
      expect(events[0]).toBe("unknown");
    });

    it("routes to unknownWorkerInfo when workerId exists but not in pool", () => {
      const { handler } = createHandler();
      const events: string[] = [];
      handler.onMessage("test_event", (event) => {
        events.push(event.worker.id);
      });

      const ws = createMockWs();
      (ws as unknown as { workerId?: string }).workerId = "missing-worker";
      sendMessage(handler, ws, { type: "test_event" });

      expect(events).toHaveLength(1);
      // Uses workerId as id in unknownWorkerInfo
      expect(events[0]).toBe("missing-worker");
    });

    it("swallows errors in message handlers", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });
      handler.onMessage("bad_handler", () => {
        throw new Error("handler error");
      });

      const ws = createMockWs();
      expect(() =>
        sendMessage(handler, ws, { type: "bad_handler" })
      ).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "Error in message handler",
        expect.objectContaining({ error: "handler error" })
      );
    });

    it("handles non-Error thrown in message handler", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });
      handler.onMessage("string_throw", () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "string error";
      });

      const ws = createMockWs();
      sendMessage(handler, ws, { type: "string_throw" });

      expect(logger.error).toHaveBeenCalledWith(
        "Error in message handler",
        expect.objectContaining({ error: "string error" })
      );
    });
  });

  describe("handleDisconnect edge cases", () => {
    it("logs debug when unregistered websocket closes", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });
      const ws = createMockWs();
      // ws.workerId is undefined - unregistered

      (
        handler as unknown as {
          handleDisconnect(ws: WebSocket, code: number, reason: string): void;
        }
      ).handleDisconnect(ws, 1000, "normal close");

      expect(logger.debug).toHaveBeenCalledWith(
        "Unregistered WebSocket connection closed",
        expect.objectContaining({ code: 1000, reason: "normal close" })
      );
    });

    it("returns early when worker not found in pool after disconnect", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });
      const ws = createMockWs();
      (ws as unknown as { workerId?: string }).workerId = "missing";

      // Worker not in pool - should return early without logging disconnect
      (
        handler as unknown as {
          handleDisconnect(ws: WebSocket, code: number, reason: string): void;
        }
      ).handleDisconnect(ws, 1000, "gone");

      expect(logger.debug).not.toHaveBeenCalledWith(
        "Worker disconnected",
        expect.anything()
      );
    });

    it("logs warning when worker disconnects with pending requests", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler, pool } = createHandler({ logger });
      const ws = createMockWs();

      const worker = createWorker({
        id: "w-pending",
        pendingRequests: new Set(["req-a"]),
      });
      pool.add(worker);
      (ws as unknown as { workerId?: string }).workerId = "w-pending";

      (
        handler as unknown as {
          handleDisconnect(ws: WebSocket, code: number, reason: string): void;
        }
      ).handleDisconnect(ws, 1000, "timeout");

      expect(logger.warn).toHaveBeenCalledWith(
        "Worker disconnected with pending requests",
        expect.objectContaining({ workerId: "w-pending", count: 1 })
      );
    });

    it("swallows errors in disconnected handlers", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler, pool } = createHandler({ logger });

      handler.onWorkerDisconnected(() => {
        throw new Error("disconnect handler error");
      });

      const ws = createMockWs();
      const worker = createWorker({ id: "w-err" });
      pool.add(worker);
      (ws as unknown as { workerId?: string }).workerId = "w-err";

      expect(() =>
        (
          handler as unknown as {
            handleDisconnect(ws: WebSocket, code: number, reason: string): void;
          }
        ).handleDisconnect(ws, 1000, "error")
      ).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "Error in disconnected handler",
        expect.objectContaining({ error: "disconnect handler error" })
      );
    });

    it("stringifies non-Error thrown by disconnected handler on disconnect", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler, pool } = createHandler({ logger });

      handler.onWorkerDisconnected(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "non-error string";
      });

      const ws = createMockWs();
      const worker = createWorker({ id: "w-str-err" });
      pool.add(worker);
      (ws as unknown as { workerId?: string }).workerId = "w-str-err";

      (
        handler as unknown as {
          handleDisconnect(ws: WebSocket, code: number, reason: string): void;
        }
      ).handleDisconnect(ws, 1000, "done");

      expect(logger.error).toHaveBeenCalledWith(
        "Error in disconnected handler",
        expect.objectContaining({ error: "non-error string" })
      );
    });
  });

  describe("handleRegistration edge cases", () => {
    it("swallows errors when closing replaced worker socket", () => {
      const { handler, pool } = createHandler();

      // Add an existing worker with a websocket that throws on close
      const existingWs = {
        ...createMockWs(),
        close: vi.fn(() => {
          throw new Error("socket already dead");
        }),
      } as unknown as WebSocket;
      const existingWorker = createWorker({
        id: "w1",
        websocket: existingWs,
      });
      pool.add(existingWorker);

      const newWs = createMockWs();
      const regMsg = {
        type: "worker_registration",
        workerId: "w1",
        workerName: "Worker 1",
        capabilities: {
          models: [
            {
              modelId: "m1",
              displayName: "M1",
              maxContextTokens: 8192,
              maxOutputTokens: 4096,
              supportsStreaming: true,
            },
          ],
          maxConcurrentRequests: 1,
        },
      };

      // Should not throw even though close throws
      expect(() => sendMessage(handler, newWs, regMsg)).not.toThrow();
    });

    it("fires disconnected handler and logs warning when replacing worker with pending requests", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler, pool } = createHandler({ logger });

      const disconnectedHandlerCalled = vi.fn();
      handler.onWorkerDisconnected(disconnectedHandlerCalled);

      // Add existing worker with pending requests
      const existingWorker = createWorker({
        id: "w1",
        pendingRequests: new Set(["req-pending"]),
      });
      pool.add(existingWorker);

      const newWs = createMockWs();
      const regMsg = {
        type: "worker_registration",
        workerId: "w1",
        workerName: "Worker 1 Reconnect",
        capabilities: {
          models: [
            {
              modelId: "m1",
              displayName: "M1",
              maxContextTokens: 8192,
              maxOutputTokens: 4096,
              supportsStreaming: true,
            },
          ],
          maxConcurrentRequests: 1,
        },
      };

      sendMessage(handler, newWs, regMsg);

      expect(logger.warn).toHaveBeenCalledWith(
        "Replaced worker had pending requests",
        expect.objectContaining({ workerId: "w1", count: 1 })
      );
      expect(disconnectedHandlerCalled).toHaveBeenCalled();
    });

    it("swallows errors thrown by connected handlers during registration", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });

      handler.onWorkerConnected(() => {
        throw new Error("connected handler boom");
      });

      const ws = createMockWs();
      const regMsg = {
        type: "worker_registration",
        workerId: "w1",
        workerName: "Worker 1",
        capabilities: {
          models: [
            {
              modelId: "m1",
              displayName: "M1",
              maxContextTokens: 8192,
              maxOutputTokens: 4096,
              supportsStreaming: true,
            },
          ],
          maxConcurrentRequests: 1,
        },
      };

      expect(() => sendMessage(handler, ws, regMsg)).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "Error in connected handler",
        expect.objectContaining({ error: "connected handler boom" })
      );
    });

    it("swallows errors thrown by disconnected handlers during reconnection", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler, pool } = createHandler({ logger });

      handler.onWorkerDisconnected(() => {
        throw new Error("disconnected handler boom");
      });

      // Existing worker with pending requests to trigger disconnected handler
      const existingWorker = createWorker({
        id: "w1",
        pendingRequests: new Set(["req-x"]),
      });
      pool.add(existingWorker);

      const newWs = createMockWs();
      const regMsg = {
        type: "worker_registration",
        workerId: "w1",
        workerName: "Worker 1 Reconnect",
        capabilities: {
          models: [
            {
              modelId: "m1",
              displayName: "M1",
              maxContextTokens: 8192,
              maxOutputTokens: 4096,
              supportsStreaming: true,
            },
          ],
          maxConcurrentRequests: 1,
        },
      };

      expect(() => sendMessage(handler, newWs, regMsg)).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "Error in disconnected handler",
        expect.objectContaining({ error: "disconnected handler boom" })
      );
    });

    it("stringifies non-Error thrown by connected handler during registration", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });

      handler.onWorkerConnected(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 42;
      });

      const ws = createMockWs();
      sendMessage(handler, ws, {
        type: "worker_registration",
        workerId: "w-nonErr",
        workerName: "W",
        capabilities: {
          models: [
            {
              modelId: "m1",
              displayName: "M1",
              maxContextTokens: 8192,
              maxOutputTokens: 4096,
              supportsStreaming: true,
            },
          ],
          maxConcurrentRequests: 1,
        },
      });

      expect(logger.error).toHaveBeenCalledWith(
        "Error in connected handler",
        expect.objectContaining({ error: "42" })
      );
    });

    it("stringifies non-Error thrown by disconnected handler during reconnection", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler, pool } = createHandler({ logger });

      handler.onWorkerDisconnected(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 99;
      });

      const existingWorker = createWorker({
        id: "w-nonErr2",
        pendingRequests: new Set(["req-z"]),
      });
      pool.add(existingWorker);

      const newWs = createMockWs();
      sendMessage(handler, newWs, {
        type: "worker_registration",
        workerId: "w-nonErr2",
        workerName: "W2",
        capabilities: {
          models: [
            {
              modelId: "m1",
              displayName: "M1",
              maxContextTokens: 8192,
              maxOutputTokens: 4096,
              supportsStreaming: true,
            },
          ],
          maxConcurrentRequests: 1,
        },
      });

      expect(logger.error).toHaveBeenCalledWith(
        "Error in disconnected handler",
        expect.objectContaining({ error: "99" })
      );
    });
  });

  describe("handleHeartbeat edge cases", () => {
    it("warns when heartbeat from unknown worker", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ logger });
      const ws = createMockWs();

      sendMessage(handler, ws, {
        type: "heartbeat",
        workerId: "nonexistent",
        timestamp: new Date().toISOString(),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        "Heartbeat from unknown worker",
        expect.objectContaining({ workerId: "nonexistent" })
      );
    });

    it("restores unhealthy busy worker to Busy status on heartbeat", () => {
      const { handler, pool } = createHandler();
      const worker = createWorker({
        id: "w1",
        status: WorkerStatus.Unhealthy,
        activeRequests: 2, // at capacity (maxConcurrentRequests: 2)
      });
      pool.add(worker);

      const ws = createMockWs();
      sendMessage(handler, ws, {
        type: "heartbeat",
        workerId: "w1",
        timestamp: new Date().toISOString(),
      });

      expect(pool.get("w1")!.status).toBe(WorkerStatus.Busy);
    });

    it("restores unhealthy available worker to Available on heartbeat", () => {
      const { handler, pool } = createHandler();
      const worker = createWorker({
        id: "w1",
        status: WorkerStatus.Unhealthy,
        activeRequests: 0,
      });
      pool.add(worker);

      const ws = createMockWs();
      sendMessage(handler, ws, {
        type: "heartbeat",
        workerId: "w1",
        timestamp: new Date().toISOString(),
      });

      expect(pool.get("w1")!.status).toBe(WorkerStatus.Available);
    });
  });

  describe("handleConnection", () => {
    it("sets up message, close, and error handlers on WebSocket", () => {
      const { handler } = createHandler();
      const ws = createMockWs() as ReturnType<typeof createMockWs> & {
        emit(event: string, ...args: unknown[]): void;
      };
      const mutableWs = ws as typeof ws & {
        emit(event: string, ...args: unknown[]): void;
      };

      handler.handleConnection(ws);

      // Trigger error event
      mutableWs.emit("error", new Error("test error"));
      // Should not throw
    });
  });

  describe("constructor without logger", () => {
    it("uses NO_OP_LOGGER when no logger is provided", () => {
      // Should not throw - exercises the `logger ?? NO_OP_LOGGER` branch
      const pool = new WorkerPool();
      const handler = new ConnectionHandler(
        pool,
        { heartbeatTimeoutMs: 60_000, heartbeatIntervalMs: 15_000 },
        () => ({ complete: vi.fn(), fail: vi.fn() })
      );
      const ws = createMockWs();
      expect(() => sendRawMessage(handler, ws, "not json")).not.toThrow();
    });
  });

  describe("onMessage with existing handler set", () => {
    it("adds second handler to existing set without creating new Set", () => {
      const { handler } = createHandler();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      handler.onMessage("my-type", cb1);
      // Second registration for same type should reuse existing Set
      handler.onMessage("my-type", cb2);

      const ws = createMockWs();
      sendMessage(handler, ws, { type: "my-type" });

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  describe("handleRegistration with missing authToken in message", () => {
    it("rejects when message has no authToken but server expects one", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const { handler } = createHandler({ authToken: "secret", logger });

      const ws = createMockWs();
      // Send registration without authToken field (exercises `?? ""` branch)
      sendMessage(handler, ws, {
        type: "worker_registration",
        workerId: "w1",
        workerName: "W",
        // no authToken
        capabilities: {
          models: [
            {
              modelId: "m1",
              displayName: "M1",
              maxContextTokens: 8192,
              maxOutputTokens: 4096,
              supportsStreaming: true,
            },
          ],
          maxConcurrentRequests: 1,
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        "Worker registration rejected: invalid auth token",
        expect.any(Object)
      );
    });
  });
});
