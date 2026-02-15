import { describe, it, expect } from "vitest";
import { deepAdd } from "../src/deepAdd.js";

describe("deepAdd", () => {
  it("adds numbers at top level", () => {
    const target = { a: 1, b: 2 };
    deepAdd(target, { a: 10 });
    expect(target).toEqual({ a: 11, b: 2 });
  });

  it("adds numbers in nested objects", () => {
    const target = { x: { y: 1, z: 2 } };
    deepAdd(target, { x: { y: 5 } });
    expect(target).toEqual({ x: { y: 6, z: 2 } });
  });

  it("handles deeply nested structures", () => {
    const target = { a: { b: { c: 1 } } };
    deepAdd(target, { a: { b: { c: 9 } } });
    expect(target).toEqual({ a: { b: { c: 10 } } });
  });

  it("ignores keys not present in target", () => {
    const target = { a: 1 };
    deepAdd(target, { a: 5, b: 99 } as Parameters<typeof deepAdd>[1]);
    expect(target).toEqual({ a: 6 });
    expect("b" in target).toBe(false);
  });

  it("handles empty source", () => {
    const target = { a: 1, b: 2 };
    deepAdd(target, {});
    expect(target).toEqual({ a: 1, b: 2 });
  });

  it("adds multiple keys in source", () => {
    const target = { a: 0, b: 0, c: 0 };
    deepAdd(target, { a: 1, c: 3 });
    expect(target).toEqual({ a: 1, b: 0, c: 3 });
  });

  it("adds zero without change", () => {
    const target = { a: 5 };
    deepAdd(target, { a: 0 });
    expect(target).toEqual({ a: 5 });
  });

  it("handles negative numbers", () => {
    const target = { a: 10 };
    deepAdd(target, { a: -3 });
    expect(target).toEqual({ a: 7 });
  });

  it("handles fractional numbers", () => {
    const target = { cost: 0.01 };
    deepAdd(target, { cost: 0.005 });
    expect(target.cost).toBeCloseTo(0.015);
  });

  it("mutates target in place", () => {
    const target = { a: 1 };
    const ref = target;
    deepAdd(target, { a: 1 });
    expect(ref).toBe(target);
    expect(ref.a).toBe(2);
  });

  it("handles mixed nested and flat fields", () => {
    const target = { count: 0, sub: { x: 0, y: 0 } };
    deepAdd(target, { count: 1, sub: { x: 2 } });
    expect(target).toEqual({ count: 1, sub: { x: 2, y: 0 } });
  });
});
