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
      isShutdownRequested: () => boolean
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

  it("catches cycle errors and continues", async () => {
    let runCount = 0;

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
    });

    for (let i = 0; i < 3; i++) {
      await vi.runAllTimersAsync();
    }

    await loopPromise;

    expect(runCount).toBe(2);
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
});
