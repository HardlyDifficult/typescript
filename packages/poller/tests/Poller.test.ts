import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Poller } from "../src/Poller.js";

describe("Poller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls fetch immediately on start", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller({ fetch: fetchFn, onChange, intervalMs: 5000 });

    await poller.start();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it("fires onChange on first fetch", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = Poller.create({
      fetch: fetchFn,
      onChange,
      intervalMs: 5000,
    });

    await poller.start();

    expect(onChange).toHaveBeenCalledWith("data", undefined);
    poller.stop();
  });

  it("supports positional constructor for backward compatibility", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const onError = vi.fn();
    const poller = new Poller(fetchFn, onChange, 5000, onError);

    await poller.start();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it("polls at the configured interval", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller({ fetch: fetchFn, onChange, intervalMs: 5000 });

    await poller.start();
    expect(fetchFn).toHaveBeenCalledTimes(1);

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
    const poller = new Poller({ fetch: fetchFn, onChange, intervalMs: 1000 });

    await poller.start();
    expect(onChange).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith("different", "same");

    poller.stop();
  });

  it("uses deep equality for change detection by default", async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) return { items: [1, 2, 3] };
      return { items: [1, 2, 3, 4] };
    });
    const onChange = vi.fn();
    const poller = new Poller({ fetch: fetchFn, onChange, intervalMs: 1000 });

    await poller.start();
    expect(onChange).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);

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
    const comparator = vi.fn(
      (current: number, previous: number | undefined) =>
        current <= (previous ?? -Infinity)
    );
    const poller = new Poller({
      fetch: fetchFn,
      onChange,
      intervalMs: 1000,
      comparator,
    });

    await poller.start();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(comparator).toHaveBeenCalledTimes(3);
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
    const poller = new Poller({ fetch: fetchFn, onChange, intervalMs: 1000 });

    await poller.start();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(
      1,
      { user: { id: 1, roles: ["admin"] } },
      undefined
    );
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      { user: { id: 1, roles: ["editor"] } },
      { user: { id: 1, roles: ["admin"] } }
    );

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
    const poller = new Poller({
      fetch: fetchFn,
      onChange,
      intervalMs: 1000,
      onError,
      comparator: () => {
        throw comparatorError;
      },
    });

    await poller.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(onChange).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(comparatorError);

    poller.stop();
  });

  it("stops polling after stop()", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller({ fetch: fetchFn, onChange, intervalMs: 1000 });

    await poller.start();
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
        return new Promise<string>((resolve) => {
          resolveFirst = () => resolve("first");
        });
      }
      return Promise.resolve("later");
    });
    const onChange = vi.fn();
    const poller = new Poller({ fetch: fetchFn, onChange, intervalMs: 1000 });

    const startPromise = poller.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    resolveFirst!();
    await startPromise;

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
    const poller = new Poller({
      fetch: fetchFn,
      onChange,
      intervalMs: 1000,
      onError,
    });

    await poller.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it("uses default trigger debounce from options", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller({
      fetch: fetchFn,
      onChange,
      intervalMs: 60000,
      debounceMs: 500,
    });

    await poller.start();
    poller.trigger();
    await vi.advanceTimersByTimeAsync(500);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("trigger() debounces multiple calls", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller({ fetch: fetchFn, onChange, intervalMs: 60000 });

    await poller.start();

    poller.trigger(500);
    poller.trigger(500);
    poller.trigger(500);

    await vi.advanceTimersByTimeAsync(500);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("trigger() does nothing when stopped", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();
    const poller = new Poller({ fetch: fetchFn, onChange, intervalMs: 60000 });

    poller.trigger();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
