import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createThrottledUpdater } from "../src/ThrottledUpdater";

describe("ThrottledUpdater", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call updateFn immediately on first update", () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const updater = createThrottledUpdater(updateFn, 1000);

    updater.update("hello");

    expect(updateFn).toHaveBeenCalledWith("hello");
    expect(updateFn).toHaveBeenCalledTimes(1);
  });

  it("should batch rapid updates and only send the latest", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const updater = createThrottledUpdater(updateFn, 1000);

    updater.update("first");
    expect(updateFn).toHaveBeenCalledWith("first");

    // These rapid updates should be batched
    updater.update("second");
    updater.update("third");
    updater.update("fourth");

    expect(updateFn).toHaveBeenCalledTimes(1);

    // Advance past the interval
    await vi.advanceTimersByTimeAsync(1000);

    expect(updateFn).toHaveBeenCalledTimes(2);
    expect(updateFn).toHaveBeenLastCalledWith("fourth");
  });

  it("should flush pending updates immediately", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const updater = createThrottledUpdater(updateFn, 1000);

    updater.update("first");
    updater.update("pending");

    expect(updateFn).toHaveBeenCalledTimes(1);

    await updater.flush();

    expect(updateFn).toHaveBeenCalledTimes(2);
    expect(updateFn).toHaveBeenLastCalledWith("pending");
  });

  it("should not update after stop is called", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const updater = createThrottledUpdater(updateFn, 1000);

    updater.update("first");
    updater.stop();

    updater.update("should not send");
    await vi.advanceTimersByTimeAsync(2000);

    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateFn).toHaveBeenCalledWith("first");
  });

  it("should clear pending timeout on stop", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const updater = createThrottledUpdater(updateFn, 1000);

    updater.update("first");
    updater.update("pending");
    updater.stop();

    await vi.advanceTimersByTimeAsync(2000);

    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateFn).toHaveBeenCalledWith("first");
  });

  it("should allow immediate update after interval has elapsed", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const updater = createThrottledUpdater(updateFn, 1000);

    updater.update("first");
    await vi.advanceTimersByTimeAsync(1000);

    updater.update("second");
    expect(updateFn).toHaveBeenCalledTimes(2);
    expect(updateFn).toHaveBeenLastCalledWith("second");
  });

  it("should handle flush with no pending updates", async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const updater = createThrottledUpdater(updateFn, 1000);

    await updater.flush();

    expect(updateFn).not.toHaveBeenCalled();
  });
});
