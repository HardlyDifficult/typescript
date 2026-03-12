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

    it("excludes non-Available workers from dispatch candidates", () => {
      pool.add(createWorker({ status: WorkerStatus.Busy }));
      expect(pool.getDispatchCandidates({ model: "test-model" })).toEqual([]);
    });

    it("excludes workers at full capacity from dispatch candidates", () => {
      pool.add(createWorker({ activeRequests: 2 })); // maxConcurrentRequests is 2
      expect(pool.getDispatchCandidates({ model: "test-model" })).toEqual([]);
    });

    it("returns candidates when category has no limit defined", () => {
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
            concurrencyLimits: { other: 2 },
          },
        })
      );
      // "local" category has no limit defined, so worker should be included
      const candidates = pool.getDispatchCandidates({
        model: "test-model",
        category: "local",
      });
      expect(candidates).toHaveLength(1);
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

  describe("releaseRequest edge cases", () => {
    it("returns false when no worker has the request", () => {
      pool.add(createWorker());
      expect(pool.releaseRequest("nonexistent-req")).toBe(false);
    });

    it("keeps category count non-zero when multiple requests share a category", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1", "local");
      pool.trackRequest("worker-1", "req-2", "local");
      pool.releaseRequest("req-1");

      // Category count should now be 1 (not deleted)
      const worker = pool.get("worker-1")!;
      expect(worker.categoryActiveRequests.get("local")).toBe(1);
    });
  });

  describe("send edge cases", () => {
    it("returns false when websocket is not open", () => {
      const ws = {
        readyState: WebSocket.CLOSED,
        send: vi.fn(),
        close: vi.fn(),
      } as unknown as WebSocket;
      pool.add(createWorker({ websocket: ws }));
      expect(pool.send("worker-1", { type: "test" })).toBe(false);
      expect(ws.send).not.toHaveBeenCalled();
    });

    it("returns false when send throws", () => {
      const ws = {
        readyState: WebSocket.OPEN,
        send: vi.fn(() => {
          throw new Error("boom");
        }),
        close: vi.fn(),
      } as unknown as WebSocket;
      pool.add(createWorker({ websocket: ws }));
      expect(pool.send("worker-1", { type: "test" })).toBe(false);
    });
  });

  describe("broadcast edge cases", () => {
    it("skips workers whose websocket is not open", () => {
      const openWs = createMockSocket();
      const closedWs = {
        readyState: WebSocket.CLOSED,
        send: vi.fn(),
        close: vi.fn(),
      } as unknown as WebSocket;

      pool.add(createWorker({ id: "open-worker", websocket: openWs }));
      pool.add(createWorker({ id: "closed-worker", websocket: closedWs }));

      pool.broadcast({ type: "ping" });

      expect(openWs.send).toHaveBeenCalled();
      expect(closedWs.send).not.toHaveBeenCalled();
    });

    it("swallows errors thrown by individual worker sends", () => {
      const throwingWs = {
        readyState: WebSocket.OPEN,
        send: vi.fn(() => {
          throw new Error("send failed");
        }),
        close: vi.fn(),
      } as unknown as WebSocket;

      pool.add(createWorker({ websocket: throwingWs }));
      expect(() => pool.broadcast({ type: "ping" })).not.toThrow();
    });
  });

  describe("getAvailableSlotCount with non-available workers", () => {
    it("skips workers that are not Available", () => {
      pool.add(createWorker({ status: WorkerStatus.Busy }));
      expect(pool.getAvailableSlotCount("test-model")).toBe(0);
    });
  });

  describe("getAvailableCount", () => {
    it("returns 0 when no workers exist", () => {
      expect(pool.getAvailableCount()).toBe(0);
    });

    it("counts only Available workers", () => {
      pool.add(createWorker({ id: "w1", status: WorkerStatus.Available }));
      pool.add(createWorker({ id: "w2", status: WorkerStatus.Busy }));
      expect(pool.getAvailableCount()).toBe(1);
    });
  });

  describe("checkHealth with already unhealthy worker", () => {
    it("does not log again for already unhealthy workers", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const warnPool = new WorkerPool(logger);
      const veryStale = new Date(Date.now() - 200_000);
      const worker = createWorker({
        lastHeartbeat: veryStale,
        status: WorkerStatus.Unhealthy,
      });
      warnPool.add(worker);

      // Should not log again since already unhealthy
      warnPool.checkHealth(60_000);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("cloneCapabilities with metadata", () => {
    it("includes metadata when capabilities.metadata is set", () => {
      const worker = createWorker({
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
          maxConcurrentRequests: 2,
          metadata: { region: "us-east-1" },
        },
      });
      pool.add(worker);
      const info = pool.getWorkerInfoList()[0];
      expect(info.capabilities.metadata).toEqual({ region: "us-east-1" });
    });
  });

  describe("releaseRequest with missing category count", () => {
    it("handles case where category count is not in map (uses ?? 0 fallback)", () => {
      pool.add(createWorker());
      pool.trackRequest("worker-1", "req-1", "local");

      // Manually corrupt the categoryActiveRequests to simulate missing entry
      const worker = pool.get("worker-1")!;
      worker.categoryActiveRequests.delete("local");

      // releaseRequest should not throw (uses ?? 0 fallback)
      expect(() => pool.releaseRequest("req-1")).not.toThrow();
    });
  });

  describe("getAvailableSlotCount with category having no active requests", () => {
    it("returns full category slots when category has no active requests yet (uses ?? 0 fallback)", () => {
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
            concurrencyLimits: { local: 3 },
          },
          categoryActiveRequests: new Map(), // empty - no active requests
        })
      );

      // Should return 3 (the category limit) since there are 0 active in category
      expect(pool.getAvailableSlotCount("test-model", "local")).toBe(3);
    });
  });
});
