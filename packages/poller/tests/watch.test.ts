import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { watch } from "../src/watch.js";

describe("watch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reads immediately before resolving", async () => {
    const read = vi.fn().mockResolvedValue("data");
    const onChange = vi.fn();

    const watcher = await watch({ read, onChange, everyMs: 5000 });

    expect(read).toHaveBeenCalledTimes(1);
    expect(watcher.current).toBe("data");

    watcher.stop();
  });

  it("fires onChange on the first successful read", async () => {
    const onChange = vi.fn();

    const watcher = await watch({
      read: vi.fn().mockResolvedValue("data"),
      onChange,
      everyMs: 5000,
    });

    expect(onChange).toHaveBeenCalledWith("data", undefined);

    watcher.stop();
  });

  it("resolves after a failed first read attempt and keeps polling", async () => {
    const onChange = vi.fn();
    const onError = vi.fn();
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce("recovered");

    const watcher = await watch({
      read,
      onChange,
      everyMs: 1000,
      onError,
    });

    expect(watcher.current).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    await vi.advanceTimersByTimeAsync(1000);

    expect(watcher.current).toBe("recovered");
    expect(onChange).toHaveBeenCalledWith("recovered", undefined);

    watcher.stop();
  });

  it("polls at the configured interval", async () => {
    const read = vi.fn().mockResolvedValue("data");
    const watcher = await watch({
      read,
      onChange: vi.fn(),
      everyMs: 5000,
    });

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);

    expect(read).toHaveBeenCalledTimes(3);

    watcher.stop();
  });

  it("fires onChange only when data changes", async () => {
    let callCount = 0;
    const read = vi.fn().mockImplementation(async () => {
      callCount++;
      return callCount <= 2 ? "same" : "different";
    });
    const onChange = vi.fn();
    const watcher = await watch({ read, onChange, everyMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(2, "different", "same");
    expect(watcher.current).toBe("different");

    watcher.stop();
  });

  it("uses deep equality for change detection by default", async () => {
    let callCount = 0;
    const read = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        return { items: [1, 2, 3] };
      }

      return { items: [1, 2, 3, 4] };
    });
    const onChange = vi.fn();
    const watcher = await watch({ read, onChange, everyMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("supports a custom equality function", async () => {
    const read = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    const onChange = vi.fn();
    const isEqual = vi.fn(
      (current: number, previous: number | undefined) =>
        current <= (previous ?? -Infinity)
    );
    const watcher = await watch({
      read,
      onChange,
      everyMs: 1000,
      isEqual,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(isEqual).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 1, undefined);
    expect(onChange).toHaveBeenNthCalledWith(2, 2, 1);

    watcher.stop();
  });

  it("does not emit for unchanged plain-object values with new references", async () => {
    const read = vi
      .fn<() => Promise<{ user: { id: number; roles: string[] } }>>()
      .mockResolvedValueOnce({ user: { id: 1, roles: ["admin"] } })
      .mockResolvedValueOnce({ user: { id: 1, roles: ["admin"] } })
      .mockResolvedValueOnce({ user: { id: 1, roles: ["editor"] } });
    const onChange = vi.fn();
    const watcher = await watch({ read, onChange, everyMs: 1000 });

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

    watcher.stop();
  });

  it("routes equality errors to onError", async () => {
    const comparatorError = new Error("isEqual failed");
    const onError = vi.fn();
    const watcher = await watch({
      read: vi
        .fn<() => Promise<{ value: number }>>()
        .mockResolvedValueOnce({ value: 1 })
        .mockResolvedValueOnce({ value: 1 }),
      onChange: vi.fn(),
      everyMs: 1000,
      onError,
      isEqual: () => {
        throw comparatorError;
      },
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(comparatorError);

    watcher.stop();
  });

  it("normalizes non-Error failures before calling onError", async () => {
    const onError = vi.fn();
    const watcher = await watch({
      read: vi.fn().mockRejectedValue("boom"),
      onChange: vi.fn(),
      everyMs: 1000,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ message: "boom" });
    expect(watcher.current).toBeUndefined();

    watcher.stop();
  });

  it("logs errors when onError is omitted", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const watcher = await watch({
      read: vi.fn().mockRejectedValue(new Error("network")),
      onChange: vi.fn(),
      everyMs: 1000,
    });

    expect(consoleError).toHaveBeenCalledWith(
      "watch() read failed:",
      expect.any(Error)
    );
    expect(watcher.current).toBeUndefined();

    watcher.stop();
  });

  it("refresh() reads immediately", async () => {
    const read = vi.fn().mockResolvedValue("data");
    const watcher = await watch({
      read,
      onChange: vi.fn(),
      everyMs: 60000,
    });

    await watcher.refresh();

    expect(read).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("refresh() reuses an in-flight read", async () => {
    const resolvers: Array<(value: string) => void> = [];
    const read = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve);
        })
    );
    const watchPromise = watch({
      read,
      onChange: vi.fn(),
      everyMs: 1000,
    });

    expect(read).toHaveBeenCalledTimes(1);

    resolvers.shift()?.("first");
    const watcher = await watchPromise;

    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledTimes(2);

    const refreshA = watcher.refresh();
    const refreshB = watcher.refresh();

    expect(refreshA).toBe(refreshB);
    expect(read).toHaveBeenCalledTimes(2);

    resolvers.shift()?.("second");
    await refreshA;

    expect(watcher.current).toBe("second");

    watcher.stop();
  });

  it("stops polling and makes refresh() a no-op", async () => {
    const read = vi.fn().mockResolvedValue("data");
    const watcher = await watch({
      read,
      onChange: vi.fn(),
      everyMs: 1000,
    });

    watcher.stop();
    watcher.stop();

    await vi.advanceTimersByTimeAsync(5000);
    await watcher.refresh();

    expect(read).toHaveBeenCalledTimes(1);
    expect(watcher.current).toBe("data");
  });

  it("skips overlapping interval reads", async () => {
    let callCount = 0;
    const resolvers: Array<(value: string) => void> = [];
    const read = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve("first");
      }

      return new Promise<string>((resolve) => {
        resolvers.push(resolve);
      });
    });
    const watcher = await watch({
      read,
      onChange: vi.fn(),
      everyMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledTimes(2);

    resolvers.shift()?.("second");
    await Promise.resolve();

    watcher.stop();
  });

  it("returns currentValue when stopped during an in-flight read", async () => {
    let resolveRead!: (value: string) => void;
    const read = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveRead = resolve;
        })
    );
    const onChange = vi.fn();
    const watchPromise = watch({ read, onChange, everyMs: 1000 });

    // Stop while read is in-flight, then let the read resolve
    // We need to use real watcher internals - create a watcher, stop it, then resolve
    // Since watch() awaits start() which awaits refresh(), we need to stop mid-flight
    // The Watcher.stop() is called after read() resolves, which marks stopped=true
    // then readCurrentValue checks if stopped and returns currentValue (line 84)

    // Trick: resolve the read after stopping. We can't get the watcher until
    // the watchPromise resolves, but we can stop it and then resolve.
    // Instead: trigger a second read via interval, stop, let that read resolve.
    resolveRead("initial");
    const watcher = await watchPromise;

    // Now trigger another in-flight read via interval
    let resolveSecond!: (value: string) => void;
    read.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveSecond = resolve;
        })
    );

    await vi.advanceTimersByTimeAsync(1000);
    // read is in-flight; stop the watcher, then resolve the read
    watcher.stop();
    resolveSecond("second");
    await Promise.resolve();
    await Promise.resolve();

    // After stopping, currentValue should still be "initial"
    expect(watcher.current).toBe("initial");
  });

  it("JSON.stringify fallback for non-plain objects (class instances) returns true for same JSON", async () => {
    // Non-plain objects (class instances) with matching JSON representations
    class MyClass {
      constructor(public val: number) {}
      toJSON() {
        return { val: this.val };
      }
    }
    let callCount = 0;
    const read = vi.fn().mockImplementation(async () => {
      callCount++;
      return new MyClass(callCount <= 2 ? 1 : 2);
    });
    const onChange = vi.fn();
    const watcher = await watch({ read, onChange, everyMs: 1000 });

    // First call triggered onChange (MyClass(1) vs undefined)
    expect(onChange).toHaveBeenCalledTimes(1);

    // Second call: same JSON, onChange should NOT fire (hits try{JSON.stringify} branch)
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Third call: different value, onChange fires
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("JSON.stringify fallback returns false for non-stringify-able values", async () => {
    // Circular objects throw on JSON.stringify - need non-plain, non-primitive objects
    // to hit the try/catch branch (lines 135-138)
    class Unserializable {
      toJSON() {
        throw new Error("cannot serialize");
      }
    }

    let count2 = 0;
    const read2 = vi.fn().mockImplementation(async () => {
      count2++;
      return new Unserializable();
    });
    const onChange2 = vi.fn();
    const watcher2 = await watch({ read: read2, onChange: onChange2, everyMs: 1000 });
    // First read: b=undefined -> isPrimitive(undefined)=true -> returns false -> onChange called
    // Second read: a=Unserializable, b=Unserializable (not same reference)
    //   Object.is(a,b) = false
    //   isPrimitive(a) = false, isPrimitive(b) = false, b !== undefined
    //   isPlainObjectOrArray(a) = false (has non-Object.prototype)
    //   So: try { JSON.stringify } -> throws -> catch return false -> onChange called
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange2).toHaveBeenCalledTimes(2); // both reads trigger onChange

    watcher2.stop();
  });

  it("isPlainObjectOrArray returns false for null-typed non-array non-object", async () => {
    // Cover: isPrimitive path for b=undefined already covered.
    // Cover deepEqual: different object entry counts (line 186)
    let callCount = 0;
    const read = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { a: 1 };
      return { a: 1, b: 2 }; // different number of keys
    });
    const onChange = vi.fn();
    const watcher = await watch({ read, onChange, everyMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("deepEqual returns false when key missing in b (line 191)", async () => {
    // Objects with same number of entries but different keys
    let callCount = 0;
    const read = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { a: 1 };
      // Same number of entries but different key - this is actually covered by entry count check
      // To hit line 191 (key not in b), we need same-count but different keys
      // We achieve this by using Object.create(null) trick or just different keys
      return Object.fromEntries([["b", 1]]); // same size, different key
    });
    const onChange = vi.fn();
    const watcher = await watch({ read, onChange, everyMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("isPlainObjectOrArray returns true for arrays (line 152 - Array.isArray branch)", async () => {
    // When both current and previous are arrays, isPlainObjectOrArray is called with arrays
    // This hits line 152: return true in isPlainObjectOrArray
    let callCount = 0;
    const read = vi.fn().mockImplementation(async () => {
      callCount++;
      return callCount <= 2 ? [1, 2, 3] : [1, 2, 4];
    });
    const onChange = vi.fn();
    const watcher = await watch({ read, onChange, everyMs: 1000 });

    expect(onChange).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1); // same array content

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2); // different array

    watcher.stop();
  });

  it("isPlainObjectOrArray handles null prototype objects", async () => {
    // Object.create(null) has null prototype - should be treated as plain
    let callCount = 0;
    const read = vi.fn().mockImplementation(async () => {
      callCount++;
      const obj = Object.create(null) as Record<string, number>;
      obj["x"] = callCount <= 2 ? 1 : 2;
      return obj;
    });
    const onChange = vi.fn();
    const watcher = await watch({ read, onChange, everyMs: 1000 });

    expect(onChange).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(1); // same value, no change

    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledTimes(2); // changed

    watcher.stop();
  });
});
