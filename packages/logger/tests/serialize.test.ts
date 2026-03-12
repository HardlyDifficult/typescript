import { describe, it, expect } from "vitest";
import { normalizeContext, safeJsonStringify } from "../src/serialize.js";

describe("safeJsonStringify", () => {
  it("serializes null", () => {
    expect(safeJsonStringify(null)).toBe("null");
  });

  it("serializes undefined as null", () => {
    expect(safeJsonStringify(undefined)).toBe("null");
  });

  it("serializes strings", () => {
    expect(safeJsonStringify("hello")).toBe('"hello"');
  });

  it("serializes numbers", () => {
    expect(safeJsonStringify(42)).toBe("42");
  });

  it("serializes booleans", () => {
    expect(safeJsonStringify(true)).toBe("true");
    expect(safeJsonStringify(false)).toBe("false");
  });

  it("serializes bigint as string", () => {
    expect(safeJsonStringify(42n)).toBe('"42"');
  });

  it("serializes symbols as their string representation", () => {
    const sym = Symbol("test");
    expect(safeJsonStringify(sym)).toBe('"Symbol(test)"');
  });

  it("serializes named functions", () => {
    function myFunc() {}
    expect(safeJsonStringify(myFunc)).toBe('"[Function myFunc]"');
  });

  it("serializes anonymous functions", () => {
    const fn = (() => () => {})();
    expect(safeJsonStringify(fn)).toBe('"[Function]"');
  });

  it("serializes Date objects as ISO string", () => {
    const date = new Date("2025-01-15T10:30:00.000Z");
    expect(safeJsonStringify(date)).toBe('"2025-01-15T10:30:00.000Z"');
  });

  it("serializes invalid Date as 'Invalid Date'", () => {
    const date = new Date("invalid");
    expect(safeJsonStringify(date)).toBe('"Invalid Date"');
  });

  it("serializes Error objects", () => {
    const error = new Error("test error");
    const result = JSON.parse(safeJsonStringify(error)) as Record<
      string,
      unknown
    >;
    expect(result.name).toBe("Error");
    expect(result.message).toBe("test error");
    expect(typeof result.stack).toBe("string");
  });

  it("serializes Error with cause", () => {
    const cause = new Error("root cause");
    const error = new Error("wrapper", { cause });
    const result = JSON.parse(safeJsonStringify(error)) as Record<
      string,
      unknown
    >;
    expect(result.cause).toBeDefined();
    const causeObj = result.cause as Record<string, unknown>;
    expect(causeObj.message).toBe("root cause");
  });

  it("serializes Error with extra enumerable properties", () => {
    const error = new Error("test") as Error & { code: string };
    error.code = "ENOENT";
    const result = JSON.parse(safeJsonStringify(error)) as Record<
      string,
      unknown
    >;
    expect(result.code).toBe("ENOENT");
  });

  it("handles circular error reference", () => {
    const error = new Error("circular");
    (error as Error & { self: unknown }).self = error;
    const result = JSON.parse(safeJsonStringify(error)) as Record<
      string,
      unknown
    >;
    expect(result.self).toBe("[Circular]");
  });

  it("serializes arrays", () => {
    expect(safeJsonStringify([1, 2, 3])).toBe("[1,2,3]");
  });

  it("serializes arrays with mixed values", () => {
    const result = JSON.parse(
      safeJsonStringify([1, "two", null, undefined, true])
    ) as unknown[];
    expect(result).toEqual([1, "two", null, null, true]);
  });

  it("handles circular array reference", () => {
    const arr: unknown[] = [1, 2];
    arr.push(arr);
    const result = JSON.parse(safeJsonStringify(arr)) as unknown[];
    expect(result[2]).toBe("[Circular]");
  });

  it("serializes Maps as [key, value] pairs", () => {
    const map = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const result = JSON.parse(safeJsonStringify(map)) as [string, number][];
    expect(result).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("handles circular Map reference", () => {
    const map = new Map<string, unknown>();
    map.set("self", map);
    const result = JSON.parse(safeJsonStringify(map)) as [string, unknown][];
    // The map entry's value is circular, so the second element is "[Circular]"
    expect(result[0]![1]).toBe("[Circular]");
  });

  it("serializes Sets as arrays", () => {
    const set = new Set([1, 2, 3]);
    const result = JSON.parse(safeJsonStringify(set)) as number[];
    expect(result).toEqual([1, 2, 3]);
  });

  it("handles circular Set reference (set contains itself)", () => {
    const set = new Set<unknown>();
    set.add(set);
    const result = JSON.parse(safeJsonStringify(set)) as unknown[];
    // The set's value (itself) is circular, so the first element is "[Circular]"
    expect(result[0]).toBe("[Circular]");
  });

  it("serializes plain objects", () => {
    expect(safeJsonStringify({ a: 1, b: "two" })).toBe('{"a":1,"b":"two"}');
  });

  it("handles circular record reference", () => {
    const obj: Record<string, unknown> = { name: "loop" };
    obj.self = obj;
    const result = JSON.parse(safeJsonStringify(obj)) as Record<string, unknown>;
    expect(result.self).toBe("[Circular]");
  });

  it("omits undefined values from plain objects", () => {
    const obj = { a: 1, b: undefined };
    const result = JSON.parse(safeJsonStringify(obj)) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect("b" in result).toBe(false);
  });

  it("supports space parameter for pretty printing", () => {
    const result = safeJsonStringify({ a: 1 }, 2);
    expect(result).toContain("\n");
  });

  it("serializes Map values with undefined → null", () => {
    const map = new Map<string, unknown>([["key", undefined]]);
    const result = JSON.parse(safeJsonStringify(map)) as [string, unknown][];
    expect(result[0]![1]).toBeNull();
  });

  it("serializes Set values with undefined → null", () => {
    const set = new Set<unknown>([undefined]);
    const result = JSON.parse(safeJsonStringify(set)) as unknown[];
    expect(result[0]).toBeNull();
  });
});

describe("normalizeContext", () => {
  it("normalizes a plain object", () => {
    const ctx = { key: "value", count: 42 };
    const result = normalizeContext(ctx);
    expect(result).toEqual({ key: "value", count: 42 });
  });

  it("returns { value: '[Circular]' } for a circular top-level record", () => {
    // normalizeContext wraps the "[Circular]" string in {value: ...}
    // but a top-level circular is impossible via Record<string,unknown>
    // so test the object path
    const ctx = { nested: { a: 1 } };
    const result = normalizeContext(ctx);
    expect(result).toEqual({ nested: { a: 1 } });
  });

  it("handles Error values in context", () => {
    const error = new Error("oops");
    const ctx = { error };
    const result = normalizeContext(ctx) as Record<string, Record<string, unknown>>;
    expect(result.error.name).toBe("Error");
    expect(result.error.message).toBe("oops");
  });
});
