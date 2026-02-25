import { describe, expect, it } from "vitest";

import { RingBuffer } from "../src/RingBuffer.js";

describe("RingBuffer", () => {
  it("stores and retrieves items in order", () => {
    const buf = new RingBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);
    expect(buf.length).toBe(3);
  });

  it("overwrites oldest items when full", () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    expect(buf.toArray()).toEqual([2, 3, 4]);
    expect(buf.length).toBe(3);
  });

  it("returns first and last", () => {
    const buf = new RingBuffer<number>(3);
    buf.push(10);
    buf.push(20);
    expect(buf.first()).toBe(10);
    expect(buf.last()).toBe(20);
  });

  it("returns undefined for first/last on empty buffer", () => {
    const buf = new RingBuffer<number>(3);
    expect(buf.first()).toBeUndefined();
    expect(buf.last()).toBeUndefined();
  });

  it("clears the buffer", () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.length).toBe(0);
    expect(buf.toArray()).toEqual([]);
  });

  it("handles wrapping multiple times", () => {
    const buf = new RingBuffer<number>(2);
    for (let i = 0; i < 10; i++) {
      buf.push(i);
    }
    expect(buf.toArray()).toEqual([8, 9]);
    expect(buf.first()).toBe(8);
    expect(buf.last()).toBe(9);
  });

  it("throws for capacity < 1", () => {
    expect(() => new RingBuffer(0)).toThrow();
  });
});
