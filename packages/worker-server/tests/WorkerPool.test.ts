import { beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

import { WorkerPool } from "../src/WorkerPool.js";
import { WorkerStatus, type ConnectedWorker } from "../src/types.js";

function createMockSocket(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
}

function createWorker(overrides?: Partial<ConnectedWorker>): ConnectedWorker {
  return {
    id: "worker-1",
    name: "Test Worker",
    websocket: createMockSocket(),
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

describe("WorkerPool", () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = new WorkerPool();
  });

  describe("add/remove/get", () => {
    it("adds and retrieves a worker", () => {
      const worker = createWorker();
      pool.add(worker);

      expect(pool.get("worker-1")).toBe(worker);
      expect(pool.has("worker-1")).toBe(true);
      expect(pool.getCount()).toBe(1);
    });

    it("removes a worker", () => {
      pool.add(createWorker());

      const removed = pool.remove("worker-1");
      expect(removed).toBeDefined();
      expect(pool.has("worker-1")).toBe(false);
      expect(pool.getCount()).toBe(0);
    });

    it("returns undefined for unknown worker", () => {
      expect(pool.get("unknown")).toBeUndefined();
      expect(pool.remove("unknown")).toBeUndefined();
    });
  });

  describe("dispatch selection", () => {
    it("returns null when no workers exist", () => {
      expect(pool.getAvailableWorker("test-model")).toBeNull();
    });

    it("returns a worker that supports the model", () => {
      pool.add(createWorker());
      const result = pool.getAvailableWorker("test-model");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("worker-1");
    });

    it("returns null for unsupported model", () => {
      pool.add(createWorker());
      expect(pool.getAvailableWorker("other-model")).toBeNull();
    });

    it("returns candidates in least-loaded order", () => {
      pool.add(createWorker({ id: "worker-1", activeRequests: 1 }));
      pool.add(createWorker({ id: "worker-2", activeRequests: 0 }));

      const candidates = pool.getDispatchCandidates({ model: "test-model" });
      expect(candidates.map((worker) => worker.id)).toEqual([
        "worker-2",
        "worker-1",
      ]);
    });

    it("respects category limits when building candidates", () => {
      pool.add(
        createWorker({
          capabilities: {
            models: [
              {
                modelId: "test-model",
                displayName: "Test",
                maxContextTokens: 8192,
                maxOutputTokens: 4096,
                supportsStreaming: true,
              },
            ],
            maxConcurrentRequests: 5,
            concurrencyLimits: { local: 1 },
          },
          categoryActiveRequests: new Map([["local", 1]]),
        })
      );

      expect(
        pool.getDispatchCandidates({ model: "test-model", category: "local" })
      ).toEqual([]);
    });
  });

  describe("trackRequest / releaseRequest", () => {
    it("increments active and adds to pending", () => {
      pool.add(createWorker());
      expect(pool.trackRequest("worker-1", "req-1")).toBe(true);

      const worker = pool.get("worker-1")!;
      expect(worker.activeRequests).toBe(1);
      expect(worker.pendingRequests.has("req-1")).toBe(true);
    });

    it("returns false when tracking an unknown worker", () => {
      expect(pool.trackRequest("unknown", "req-1")).toBe(false);
    });

    it("transitions to Busy when at capacity", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1");
      pool.trackRequest("worker-1", "req-2");

      expect(pool.get("worker-1")!.status).toBe(WorkerStatus.Busy);
    });

    it("releases a request and transitions back to Available", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1");
      pool.trackRequest("worker-1", "req-2");

      expect(pool.releaseRequest("req-1")).toBe(true);
      expect(pool.get("worker-1")!.activeRequests).toBe(1);
      expect(pool.get("worker-1")!.status).toBe(WorkerStatus.Available);
    });

    it("increments completedRequests when option is set", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1");
      pool.releaseRequest("req-1", { incrementCompleted: true });

      expect(pool.get("worker-1")!.completedRequests).toBe(1);
    });

    it("deletes empty category counts on release", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1", "local");
      pool.releaseRequest("req-1");

      expect(pool.get("worker-1")!.categoryActiveRequests.has("local")).toBe(
        false
      );
    });
  });

  describe("checkHealth", () => {
    it("returns empty array for healthy workers", () => {
      pool.add(createWorker());
      expect(pool.checkHealth(60_000)).toEqual([]);
    });

    it("marks worker unhealthy after timeout", () => {
      const staleDate = new Date(Date.now() - 120_000);
      pool.add(createWorker({ lastHeartbeat: staleDate }));

      pool.checkHealth(60_000);
      expect(pool.get("worker-1")!.status).toBe(WorkerStatus.Unhealthy);
    });

    it("returns dead worker ids after 3x timeout", () => {
      const veryStale = new Date(Date.now() - 200_000);
      pool.add(createWorker({ lastHeartbeat: veryStale }));

      const dead = pool.checkHealth(60_000);
      expect(dead).toEqual(["worker-1"]);
    });
  });

  describe("send / broadcast", () => {
    it("sends a message to a specific worker", () => {
      const ws = createMockSocket();
      pool.add(createWorker({ websocket: ws }));

      const result = pool.send("worker-1", { type: "test" });
      expect(result).toBe(true);
      expect(ws.send).toHaveBeenCalledWith('{"type":"test"}');
    });

    it("returns false for unknown worker", () => {
      expect(pool.send("unknown", { type: "test" })).toBe(false);
    });

    it("broadcasts to all open workers", () => {
      const ws1 = createMockSocket();
      const ws2 = createMockSocket();
      pool.add(createWorker({ id: "w1", websocket: ws1 }));
      pool.add(createWorker({ id: "w2", websocket: ws2 }));

      pool.broadcast({ type: "shutdown" });
      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });
  });

  describe("getAvailableSlotCount", () => {
    it("returns 0 when no workers exist", () => {
      expect(pool.getAvailableSlotCount("test-model")).toBe(0);
    });

    it("returns free slots for a single worker", () => {
      pool.add(createWorker({ activeRequests: 1 }));
      expect(pool.getAvailableSlotCount("test-model")).toBe(1);
    });

    it("sums free slots across multiple workers", () => {
      pool.add(createWorker({ id: "worker-1", activeRequests: 1 }));
      pool.add(createWorker({ id: "worker-2", activeRequests: 0 }));
      expect(pool.getAvailableSlotCount("test-model")).toBe(3);
    });

    it("returns 0 for unsupported model", () => {
      pool.add(createWorker());
      expect(pool.getAvailableSlotCount("other-model")).toBe(0);
    });

    it("respects category limits when provided", () => {
      pool.add(
        createWorker({
          capabilities: {
            models: [
              {
                modelId: "test-model",
                displayName: "Test",
                maxContextTokens: 8192,
                maxOutputTokens: 4096,
                supportsStreaming: true,
              },
            ],
            maxConcurrentRequests: 5,
            concurrencyLimits: { local: 2 },
          },
          categoryActiveRequests: new Map([["local", 1]]),
        })
      );

      expect(pool.getAvailableSlotCount("test-model", "local")).toBe(1);
    });
  });

  describe("getWorkerInfoList", () => {
    it("returns immutable snapshots without websocket state", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1", "local");

      const worker = pool.getWorkerInfoList()[0];
      expect(worker.id).toBe("worker-1");
      expect(worker.requests.pendingIds).toEqual(["req-1"]);
      expect(worker.requests.activeByCategory).toEqual({ local: 1 });
      expect("websocket" in worker).toBe(false);
      expect(() => {
        (worker.requests.pendingIds as string[]).push("extra");
      }).toThrow();
    });
  });

  describe("closeAll", () => {
    it("closes all worker connections and clears the pool", () => {
      const ws = createMockSocket();
      pool.add(createWorker({ websocket: ws }));

      pool.closeAll();
      expect(ws.close).toHaveBeenCalled();
      expect(pool.getCount()).toBe(0);
    });
  });
});
