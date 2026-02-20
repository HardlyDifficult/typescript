import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { runContinuousLoop } from "../src/runContinuousLoop.js";

describe("runContinuousLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs cycle until shutdown is requested", async () => {
    let runCount = 0;

    const runCycle = async (
      _isShutdownRequested: () => boolean
    ): Promise<void> => {
      runCount++;
      if (runCount >= 3) {
        // Trigger shutdown from inside the cycle
        process.emit("SIGTERM");
      }
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
    });

    // Advance timers to trigger the sleep timeouts
    for (let i = 0; i < 5; i++) {
      await vi.runAllTimersAsync();
    }

    await loopPromise;

    expect(runCount).toBe(3);
  });

  it("calls onShutdown when finished", async () => {
    const onShutdown = vi.fn().mockResolvedValue(undefined);

    const runCycle = async (): Promise<void> => {
      process.emit("SIGINT");
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      onShutdown,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    expect(onShutdown).toHaveBeenCalledOnce();
  });

  it("catches cycle errors, logs, and continues by default", async () => {
    let runCount = 0;
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    const runCycle = async (): Promise<void> => {
      runCount++;
      if (runCount === 1) {
        throw new Error("Boom");
      }
      if (runCount >= 2) {
        process.emit("SIGTERM");
      }
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      logger,
    });

    for (let i = 0; i < 3; i++) {
      await vi.runAllTimersAsync();
    }

    await loopPromise;

    expect(runCount).toBe(2);
    expect(logger.error).toHaveBeenCalledWith(
      "Cycle error",
      expect.objectContaining({
        cycleNumber: 1,
        error: "Boom",
      })
    );
  });

  it("passes isShutdownRequested to runCycle", async () => {
    let checkedIsShutdown = false;

    const runCycle = async (
      isShutdownRequested: () => boolean
    ): Promise<void> => {
      checkedIsShutdown = isShutdownRequested();
      process.emit("SIGTERM");
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    expect(checkedIsShutdown).toBe(false);
  });

  it("supports dynamic delay returned from runCycle", async () => {
    let runCount = 0;

    const runCycle = async (): Promise<number | "immediate" | { stop: true }> => {
      runCount++;
      if (runCount === 1) {
        return 10;
      }
      if (runCount === 2) {
        return "immediate";
      }
      return { stop: true };
    };

    const loopPromise = runContinuousLoop({
      intervalSeconds: 60,
      runCycle,
    });

    await Promise.resolve();
    expect(runCount).toBe(1);

    await vi.advanceTimersByTimeAsync(9);
    expect(runCount).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    await loopPromise;

    expect(runCount).toBe(3);
  });

  it("supports getNextDelayMs(result) for domain results", async () => {
    type CycleResult = { backoffMs: number } | { stop: true };
    let runCount = 0;

    const runCycle = async (): Promise<CycleResult> => {
      runCount++;
      if (runCount < 3) {
        return { backoffMs: 5 };
      }
      return { stop: true };
    };

    const getNextDelayMs = vi.fn(
      (result: CycleResult): number | undefined => {
        if ("backoffMs" in result) {
          return result.backoffMs;
        }
        return undefined;
      }
    );

    const loopPromise = runContinuousLoop({
      intervalSeconds: 60,
      runCycle,
      getNextDelayMs,
    });

    await Promise.resolve();
    expect(runCount).toBe(1);

    await vi.advanceTimersByTimeAsync(5);
    expect(runCount).toBe(2);

    await vi.advanceTimersByTimeAsync(5);
    await loopPromise;

    expect(runCount).toBe(3);
    expect(getNextDelayMs).toHaveBeenCalledTimes(2);
    expect(getNextDelayMs).toHaveBeenNthCalledWith(
      1,
      { backoffMs: 5 },
      expect.objectContaining({ cycleNumber: 1 })
    );
    expect(getNextDelayMs).toHaveBeenNthCalledWith(
      2,
      { backoffMs: 5 },
      expect.objectContaining({ cycleNumber: 2 })
    );
  });

  it("allows runCycle to stop the loop gracefully", async () => {
    const runCycle = vi
      .fn<() => Promise<{ stop: true }>>()
      .mockResolvedValue({ stop: true });

    await runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
    });

    expect(runCycle).toHaveBeenCalledOnce();
  });

  it("uses onCycleError to stop loop when requested", async () => {
    const runCycle = vi.fn(async (): Promise<void> => {
      throw new Error("boom");
    });
    const onCycleError = vi.fn().mockResolvedValue("stop");

    await runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      onCycleError,
    });

    expect(runCycle).toHaveBeenCalledOnce();
    expect(onCycleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ cycleNumber: 1 })
    );
  });

  it("uses onCycleError to continue without default error logging", async () => {
    let runCount = 0;
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    const runCycle = async (): Promise<{ stop: true }> => {
      runCount++;
      if (runCount === 1) {
        throw new Error("boom");
      }
      return { stop: true };
    };
    const onCycleError = vi.fn().mockResolvedValue("continue");

    const loopPromise = runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      onCycleError,
      logger,
    });

    await vi.runAllTimersAsync();
    await loopPromise;

    expect(runCount).toBe(2);
    expect(onCycleError).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("uses injected logger for shutdown warnings", async () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    const runCycle = async (): Promise<void> => {
      process.emit("SIGINT");
    };

    await runContinuousLoop({
      intervalSeconds: 1,
      runCycle,
      logger,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Received SIGINT, shutting down gracefully..."
    );
  });
});
