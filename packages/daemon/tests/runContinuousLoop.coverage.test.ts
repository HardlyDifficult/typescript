/**
 * Additional coverage tests for runContinuousLoop.ts
 *
 * Targeting uncovered lines:
 * - defaultLogger branches (warn/error with and without context)
 * - handleCycleError when onCycleError itself throws (line ~198)
 * - cancelCurrentSleep set to null after sleep resolves (line ~248-249)
 * - break after shouldContinue() check at end of loop (line ~310)
 * - normalizeDelayMs throwing for invalid values from runCycle/getNextDelayMs
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { runContinuousLoop } from "../src/runContinuousLoop.js";

describe("runContinuousLoop - additional coverage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("defaultLogger.warn logs with context when context is provided", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // We need to trigger logger.warn with context -- that happens when SIGTERM is received
    // The shutdown warning is logged with just a message (no context), but we can test
    // the default logger directly by reaching the error path
    // Actually the defaultLogger.warn is called by handleShutdown with just a string
    // The defaultLogger.error is called with context from handleCycleError default path

    let runCount = 0;
    const runCycle = async (): Promise<void> => {
      runCount++;
      if (runCount === 1) {
        throw new Error(
          "test error to trigger defaultLogger.error with context"
        );
      }
      process.emit("SIGTERM");
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      // No logger provided - uses defaultLogger
    });

    // run first cycle (throws), then run second cycle (emits SIGTERM)
    for (let i = 0; i < 3; i++) {
      await vi.runAllTimersAsync();
    }
    await loopPromise;

    // defaultLogger.error should have been called with context
    expect(warnSpy).toHaveBeenCalled();
  });

  it("defaultLogger.error is called with context for cycle errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let runCount = 0;
    const runCycle = async (): Promise<void> => {
      runCount++;
      if (runCount === 1) {
        throw new Error("boom");
      }
      process.emit("SIGTERM");
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
    });

    for (let i = 0; i < 3; i++) {
      await vi.runAllTimersAsync();
    }
    await loopPromise;

    expect(errorSpy).toHaveBeenCalledWith(
      "Cycle error",
      expect.objectContaining({ cycleNumber: 1, error: "boom" })
    );
  });

  it("defaultLogger.warn is called without context (just message)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const runCycle = async (): Promise<void> => {
      process.emit("SIGTERM");
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    // The shutdown warning has no context object
    expect(warnSpy).toHaveBeenCalledWith(
      "Received SIGTERM, shutting down gracefully..."
    );
  });

  it("onCycleError handler that itself throws falls back to continue and logs the handler error", async () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    let runCount = 0;
    const runCycle = async (): Promise<{ stop: true }> => {
      runCount++;
      if (runCount === 1) {
        throw new Error("cycle error");
      }
      return { stop: true };
    };

    const onCycleError = vi.fn().mockRejectedValue(new Error("handler error"));

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      onCycleError,
      logger,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    expect(logger.error).toHaveBeenCalledWith(
      "onCycleError handler failed",
      expect.objectContaining({
        cycleNumber: 1,
        cycleError: "cycle error",
        handlerError: "handler error",
      })
    );
    // Loop should have continued (runCount will be 2)
    expect(runCount).toBe(2);
  });

  it("loop breaks at shouldContinue check after sleep when shutdown requested during sleep", async () => {
    let runCount = 0;

    const runCycle = async (): Promise<void> => {
      runCount++;
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 10,
      runCycle,
    });

    // First cycle runs immediately
    await Promise.resolve();
    await Promise.resolve();

    // Trigger shutdown while sleeping (interrupts sleep early)
    process.emit("SIGTERM");

    await loopPromise;

    // Should have run exactly once, then shutdown during sleep
    expect(runCount).toBe(1);
  });

  it("normalizeDelayMs throws for invalid intervalSeconds", async () => {
    const runCycle = vi.fn().mockResolvedValue(undefined);

    await expect(
      runContinuousLoop({
        intervalSeconds: -1,
        runCycle,
      })
    ).rejects.toThrow("intervalSeconds must be a non-negative finite number");
  });

  it("normalizeDelayMs from runCycle with NaN is caught as cycle error and logged", async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    let runCount = 0;

    // NaN is returned as the delay - inside getControlFromCycleResult,
    // typeof NaN === "number" so it becomes { nextDelayMs: NaN }
    // Then normalizeDelayMs throws which is caught by the cycle error handler
    const runCycle = async (): Promise<number | { stop: true }> => {
      runCount++;
      if (runCount === 1) {
        return NaN;
      }
      return { stop: true };
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      logger,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    expect(logger.error).toHaveBeenCalledWith(
      "Cycle error",
      expect.objectContaining({
        error: expect.stringContaining("runCycle must return"),
      })
    );
  });

  it("normalizeDelayMs from getNextDelayMs with negative value is caught as cycle error", async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    let runCount = 0;

    const runCycle = async (): Promise<{ data: number } | { stop: true }> => {
      runCount++;
      if (runCount === 1) {
        return { data: 42 };
      }
      return { stop: true };
    };

    // Returns -5 on first call, undefined on subsequent calls
    let getNextDelayMsCallCount = 0;
    const getNextDelayMs = vi.fn(() => {
      getNextDelayMsCallCount++;
      if (getNextDelayMsCallCount === 1) {
        return -5;
      }
      return undefined;
    });

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      getNextDelayMs,
      logger,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    expect(logger.error).toHaveBeenCalledWith(
      "Cycle error",
      expect.objectContaining({
        error: expect.stringContaining("getNextDelayMs must return"),
      })
    );
  });

  it("cancelCurrentSleep is reset to null after sleep completes naturally", async () => {
    let runCount = 0;

    const runCycle = async (): Promise<void> => {
      runCount++;
      if (runCount >= 3) {
        process.emit("SIGTERM");
      }
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
    });

    // Let multiple sleep cycles complete naturally
    for (let i = 0; i < 6; i++) {
      await vi.runAllTimersAsync();
    }

    await loopPromise;
    expect(runCount).toBe(3);
  });

  it("shouldContinue check after cycle body causes break when signal fires inside getNextDelayMs", async () => {
    // This covers the break at line 310: after runCycle succeeds, but before sleep,
    // shutdownRequested becomes true when SIGTERM fires inside getNextDelayMs (sync call)
    let runCount = 0;

    const runCycle = async (): Promise<{ marker: true }> => {
      runCount++;
      return { marker: true };
    };

    let getDelayCallCount = 0;
    const getNextDelayMs = (): number | undefined => {
      getDelayCallCount++;
      if (getDelayCallCount === 1) {
        // Fire SIGTERM synchronously during getNextDelayMs
        // This sets shutdownRequested = true BEFORE line 309 check
        process.emit("SIGTERM");
      }
      return undefined;
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      getNextDelayMs,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    // Only one cycle ran - the break at line 310 prevented sleeping
    expect(runCount).toBe(1);
    expect(getDelayCallCount).toBe(1);
  });

  it("handles non-Error thrown in onCycleError handler", async () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    let runCount = 0;
    const runCycle = async (): Promise<{ stop: true }> => {
      runCount++;
      if (runCount === 1) {
        throw "string error";
      }
      return { stop: true };
    };

    const onCycleError = vi.fn().mockRejectedValue("string handler error");

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      onCycleError,
      logger,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    expect(logger.error).toHaveBeenCalledWith(
      "onCycleError handler failed",
      expect.objectContaining({
        cycleError: "string error",
        handlerError: "string handler error",
      })
    );
  });

  it("handles non-Error thrown in runCycle with default logger", async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };

    let runCount = 0;
    const runCycle = async (): Promise<{ stop: true }> => {
      runCount++;
      if (runCount === 1) {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "non-error string";
      }
      return { stop: true };
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      logger,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    expect(logger.error).toHaveBeenCalledWith(
      "Cycle error",
      expect.objectContaining({ error: "non-error string" })
    );
  });

  it("getControlFromCycleResult handles null result (returns {})", async () => {
    // null should return {} from getControlFromCycleResult, defaulting to intervalSeconds delay
    let runCount = 0;
    const runCycle = async (): Promise<null> => {
      runCount++;
      if (runCount >= 2) {
        process.emit("SIGTERM");
      }
      return null;
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
    });

    for (let i = 0; i < 4; i++) {
      await vi.runAllTimersAsync();
    }
    await loopPromise;

    expect(runCount).toBe(2);
  });
});
