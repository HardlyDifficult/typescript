import { describe, it, expect, beforeEach } from "vitest";
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

  describe("getAvailableWorker", () => {
    it("returns null when no workers exist", () => {
      expect(pool.getAvailableWorker("test-model")).toBeNull();
    });

    it("returns worker that supports the model", () => {
      pool.add(createWorker());
      const result = pool.getAvailableWorker("test-model");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("worker-1");
    });

    it("returns null for unsupported model", () => {
      pool.add(createWorker());
      expect(pool.getAvailableWorker("other-model")).toBeNull();
    });

    it("skips busy workers", () => {
      pool.add(createWorker({ status: WorkerStatus.Busy }));
      expect(pool.getAvailableWorker("test-model")).toBeNull();
    });

    it("skips unhealthy workers", () => {
      pool.add(createWorker({ status: WorkerStatus.Unhealthy }));
      expect(pool.getAvailableWorker("test-model")).toBeNull();
    });

    it("skips workers at max concurrent requests", () => {
      pool.add(createWorker({ activeRequests: 2 }));
      expect(pool.getAvailableWorker("test-model")).toBeNull();
    });

    it("returns least-loaded worker", () => {
      pool.add(createWorker({ id: "worker-1", activeRequests: 1 }));
      pool.add(createWorker({ id: "worker-2", activeRequests: 0 }));
      const result = pool.getAvailableWorker("test-model");
      expect(result!.id).toBe("worker-2");
    });
  });

  describe("getAnyAvailableWorker", () => {
    it("returns Available worker", () => {
      pool.add(createWorker());
      expect(pool.getAnyAvailableWorker()).not.toBeNull();
    });

    it("returns Busy worker (they can still handle model-agnostic tasks)", () => {
      pool.add(createWorker({ status: WorkerStatus.Busy }));
      expect(pool.getAnyAvailableWorker()).not.toBeNull();
    });

    it("skips Unhealthy workers", () => {
      pool.add(createWorker({ status: WorkerStatus.Unhealthy }));
      expect(pool.getAnyAvailableWorker()).toBeNull();
    });

    it("returns null when empty", () => {
      expect(pool.getAnyAvailableWorker()).toBeNull();
    });
  });

  describe("trackRequest / releaseRequest", () => {
    it("increments active and adds to pending", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1");

      const worker = pool.get("worker-1")!;
      expect(worker.activeRequests).toBe(1);
      expect(worker.pendingRequests.has("req-1")).toBe(true);
    });

    it("transitions to Busy when at capacity", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1");
      pool.trackRequest("worker-1", "req-2");

      expect(pool.get("worker-1")!.status).toBe(WorkerStatus.Busy);
    });

    it("releases request and transitions back to Available", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1");
      pool.trackRequest("worker-1", "req-2");
      expect(pool.get("worker-1")!.status).toBe(WorkerStatus.Busy);

      pool.releaseRequest("req-1");
      expect(pool.get("worker-1")!.activeRequests).toBe(1);
      expect(pool.get("worker-1")!.status).toBe(WorkerStatus.Available);
    });

    it("increments completedRequests when option is set", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1");
      pool.releaseRequest("req-1", { incrementCompleted: true });

      expect(pool.get("worker-1")!.completedRequests).toBe(1);
    });

    it("does not increment completedRequests by default", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1");
      pool.releaseRequest("req-1");

      expect(pool.get("worker-1")!.completedRequests).toBe(0);
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

    it("returns dead worker IDs after 3x timeout", () => {
      const veryStale = new Date(Date.now() - 200_000);
      pool.add(createWorker({ lastHeartbeat: veryStale }));

      const dead = pool.checkHealth(60_000);
      expect(dead).toEqual(["worker-1"]);
    });
  });

  describe("send / broadcast", () => {
    it("sends message to a specific worker", () => {
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
      pool.add(createWorker({ activeRequests: 1 })); // maxConcurrentRequests: 2
      expect(pool.getAvailableSlotCount("test-model")).toBe(1);
    });

    it("sums free slots across multiple workers", () => {
      pool.add(createWorker({ id: "worker-1", activeRequests: 1 }));
      pool.add(createWorker({ id: "worker-2", activeRequests: 0 }));
      expect(pool.getAvailableSlotCount("test-model")).toBe(3); // 1 + 2
    });

    it("excludes non-Available workers", () => {
      pool.add(
        createWorker({
          id: "worker-1",
          status: WorkerStatus.Busy,
          activeRequests: 2,
        })
      );
      pool.add(createWorker({ id: "worker-2", activeRequests: 0 }));
      expect(pool.getAvailableSlotCount("test-model")).toBe(2);
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
      // workerFreeSlots = 5, categoryFreeSlots = 2 - 1 = 1 → min(5, 1) = 1
      expect(pool.getAvailableSlotCount("test-model", "local")).toBe(1);
    });
  });

  describe("getWorkerInfoList", () => {
    it("returns info without websocket", () => {
      pool.add(createWorker());
      const list = pool.getWorkerInfoList();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("worker-1");
      expect("websocket" in list[0]).toBe(false);
    });
  });

  describe("closeAll", () => {
    it("closes all worker connections and clears pool", () => {
      const ws = createMockSocket();
      pool.add(createWorker({ websocket: ws }));

      pool.closeAll();
      expect(ws.close).toHaveBeenCalled();
      expect(pool.getCount()).toBe(0);
    });
  });
});
