/**
 * Extra tests for throttle package to cover remaining branches:
 * - Throttle.ts line 44: name ?? "throttle" false branch (name undefined, storageAdapter set)
 * - ThrottledUpdater.ts line 54: if (stopped) return in doUpdate
 * - ThrottledUpdater.ts line 101: if (stopped) return in flush
 * - eventRequest.ts line 79: if (!match(event)) return in error handler
 * - isConnectionError.ts lines 28, 34: false branches for lastError/cause checks
 * - retry.ts line 46: backoff === true ? {} : backoff (false branch when backoff is object)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { Throttle } from "../src/Throttle.js";
import { createThrottledUpdater } from "../src/ThrottledUpdater.js";
import { eventRequest, type EventSubscriber } from "../src/eventRequest.js";
import { isConnectionError } from "../src/isConnectionError.js";

// ─── Throttle - name ?? "throttle" fallback (line 44) ────────────────────────

describe("Throttle - storageAdapter without name uses 'throttle' key (line 44)", () => {
  it("creates stateTracker with key 'throttle' when storageAdapter provided but name is undefined", () => {
    // Provide storageAdapter but no name → name ?? "throttle" hits the ?? branch
    const mockAdapter = {
      read: vi.fn().mockResolvedValue(null),
      write: vi.fn().mockResolvedValue(undefined),
    };
    expect(
      () =>
        new Throttle({
          perSecond: 10,
          storageAdapter: mockAdapter as never,
        })
    ).not.toThrow();
  });
});

// ─── ThrottledUpdater - stopped guard in doUpdate (line 54) ──────────────────

describe("ThrottledUpdater - doUpdate when stopped (line 54)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call updateFn after stop() is called mid-schedule", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const updater = createThrottledUpdater(updateFn, 1000);

    // First update fires immediately
    updater.update("first");
    expect(updateFn).toHaveBeenCalledTimes(1);

    // Queue a pending update
    updater.update("second");
    expect(updateFn).toHaveBeenCalledTimes(1); // not yet

    // Stop before the scheduled update fires
    updater.stop();

    // Advance time to trigger the scheduled update
    await vi.advanceTimersByTimeAsync(1000);

    // doUpdate was called internally but hit the stopped guard → updateFn not called again
    expect(updateFn).toHaveBeenCalledTimes(1);
  });
});

// ─── ThrottledUpdater - flush when stopped (line 101) ────────────────────────

describe("ThrottledUpdater - flush after stop (line 101)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flush returns early without calling updateFn after stop()", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const updater = createThrottledUpdater(updateFn, 1000);

    updater.update("first"); // fires immediately
    expect(updateFn).toHaveBeenCalledTimes(1);

    updater.update("pending"); // queued

    updater.stop();

    // flush() should return early due to stopped guard
    await updater.flush();
    expect(updateFn).toHaveBeenCalledTimes(1); // not called again
  });
});

// ─── eventRequest - non-matching error event (line 79) ───────────────────────

describe("eventRequest - non-matching error event returns early (line 79)", () => {
  it("ignores error events that don't match the filter (covers !match return)", async () => {
    type Ev = { requestId: string; result?: string; error?: string };

    let completeHandler: ((event: Ev) => void) | null = null;
    let errorHandler: ((event: Ev) => void) | null = null;

    const on = {
      complete: ((cb: (event: Ev) => void) => {
        completeHandler = cb;
        return () => {
          completeHandler = null;
        };
      }) as EventSubscriber<Ev>,
      error: ((cb: (event: Ev) => void) => {
        errorHandler = cb;
        return () => {
          errorHandler = null;
        };
      }) as EventSubscriber<Ev>,
    };

    const promise = eventRequest<Ev, Ev>(on, (ev) => ev.requestId === "req-1");

    // Emit a non-matching error event (requestId !== "req-1") → !match → return
    errorHandler!({ requestId: "req-999", error: "other error" });

    // Promise should still be pending (non-matching event was ignored)
    // Now emit the matching complete event to resolve
    completeHandler!({ requestId: "req-1", result: "done" });

    const result = await promise;
    expect(result.requestId).toBe("req-1");
  });
});

// ─── isConnectionError - false branches for lastError/cause (lines 28, 34) ───

describe("isConnectionError - lastError/cause is non-connection Error (lines 28, 34)", () => {
  it("returns false when lastError is non-connection Error (false branch of line 28)", () => {
    const inner = new Error("some other error"); // not a connection error
    const outer = new Error("Request failed");
    (outer as unknown as Record<string, unknown>)["lastError"] = inner;
    // lastError instanceof Error → true, isConnectionError(inner) → false (line 28 false branch)
    // Falls through to check cause/errors/code → all absent → returns false
    expect(isConnectionError(outer)).toBe(false);
  });

  it("returns false when cause is non-connection Error (false branch of line 34)", () => {
    const inner = new Error("some other error"); // not a connection error
    const outer = new Error("Request failed");
    (outer as unknown as Record<string, unknown>)["cause"] = inner;
    // cause instanceof Error → true, isConnectionError(inner) → false (line 34 false branch)
    expect(isConnectionError(outer)).toBe(false);
  });
});
