import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Poller } from "../src/Poller.js";

describe("Poller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls fetchFn immediately on start", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 5000);

    await poller.start();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it("fires onChange on first fetch", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 5000);

    await poller.start();

    expect(onChange).toHaveBeenCalledWith("data", undefined);
    poller.stop();
  });

  it("polls at the configured interval", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 5000);

    await poller.start();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Advance past the interval
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it("fires onChange only when data changes", async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      return callCount <= 2 ? "same" : "different";
    });
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 1000);

    await poller.start();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("same", undefined);

    // Second poll, same data — no change
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Third poll, different data — fires onChange
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith("different", "same");

    poller.stop();
  });

  it("uses deep equality for change detection", async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      // Return structurally equal but different object references
      if (callCount <= 2) return { items: [1, 2, 3] };
      return { items: [1, 2, 3, 4] };
    });
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 1000);

    await poller.start();
    expect(onChange).toHaveBeenCalledTimes(1);

    // Same structure — no change
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Different structure — fires
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2);

    poller.stop();
  });


  it("supports a custom comparator", async () => {
    const fetchFn = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    const onChange = vi.fn();
    const isEqual = vi.fn((current: number, previous: number | undefined) => current <= (previous ?? -Infinity));
    const poller = new Poller(fetchFn, onChange, 1000, { isEqual });

    await poller.start();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(isEqual).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 1, undefined);
    expect(onChange).toHaveBeenNthCalledWith(2, 2, 1);

    poller.stop();
  });

  it("does not fire onChange for unchanged plain-object values with new references", async () => {
    const fetchFn = vi
      .fn<() => Promise<{ user: { id: number; roles: string[] } }>>()
      .mockResolvedValueOnce({ user: { id: 1, roles: ["admin"] } })
      .mockResolvedValueOnce({ user: { id: 1, roles: ["admin"] } })
      .mockResolvedValueOnce({ user: { id: 1, roles: ["editor"] } });
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 1000);

    await poller.start();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, { user: { id: 1, roles: ["admin"] } }, undefined);
    expect(onChange).toHaveBeenNthCalledWith(2, { user: { id: 1, roles: ["editor"] } }, { user: { id: 1, roles: ["admin"] } });

    poller.stop();
  });

  it("routes comparator errors to onError", async () => {
    const fetchFn = vi
      .fn<() => Promise<{ value: number }>>()
      .mockResolvedValueOnce({ value: 1 })
      .mockResolvedValueOnce({ value: 1 });
    const onChange = vi.fn();
    const onError = vi.fn();
    const comparatorError = new Error("comparator failed");
    const poller = new Poller(fetchFn, onChange, 1000, {
      onError,
      isEqual: () => {
        throw comparatorError;
      },
    });

    await poller.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(comparatorError);

    poller.stop();
  });

  it("stops polling after stop()", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 1000);

    await poller.start();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    poller.stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("skips overlapping polls", async () => {
    let resolveFirst: () => void;
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: never resolves during test
        return new Promise<string>((resolve) => {
          resolveFirst = () => resolve("first");
        });
      }
      return Promise.resolve("later");
    });
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 1000);

    // Start — kicks off first (slow) fetch
    const startPromise = poller.start();

    // Advance timer — interval fires, but first poll is still running
    await vi.advanceTimersByTimeAsync(1000);

    // fetchFn should only have been called once (the overlapping call was skipped)
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Resolve the first fetch
    resolveFirst!();
    await startPromise;

    // Now the next interval should work
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("continues polling on fetch errors", async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 2) throw new Error("network error");
      return "data";
    });
    const onChange = vi.fn();
    const onError = vi.fn();
    const poller = new Poller(fetchFn, onChange, 1000, onError);

    await poller.start();
    expect(onChange).toHaveBeenCalledTimes(1);

    // Second poll errors
    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    // Third poll succeeds
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it("does not throw when fetch errors and no onError provided", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 1000);

    // Should not throw
    await poller.start();

    // Next poll should work fine
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledWith("data", undefined);

    poller.stop();
  });

  it("trigger() fires a debounced poll", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 60000);

    await poller.start();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Trigger with debounce
    poller.trigger(500);
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("trigger() debounces multiple calls", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 60000);

    await poller.start();

    // Multiple rapid triggers — only the last one should fire
    poller.trigger(500);
    poller.trigger(500);
    poller.trigger(500);

    await vi.advanceTimersByTimeAsync(500);
    // Only one additional poll from the debounced trigger
    expect(fetchFn).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("trigger() does nothing when stopped", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 60000);

    // Never started — trigger should be a no-op
    poller.trigger();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("start() is idempotent", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller(fetchFn, onChange, 5000);

    await poller.start();
    await poller.start();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    poller.stop();
  });
});
