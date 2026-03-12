/**
 * Extra tests for math package uncovered lines:
 * - RingBuffer line 36 (undefined item guard in toArray)
 * - RollingVwap line 27 (value getter using Date.now)
 * - VwapTracker lines 33-34 (variance <= 0, sigma <= 0)
 * - WindowedChange line 46 (first.value === 0)
 * - bookImbalance line 21 (mid <= 0)
 */
import { describe, expect, it } from "vitest";

import { RingBuffer } from "../src/RingBuffer.js";
import { RollingVwap } from "../src/RollingVwap.js";
import { VwapTracker } from "../src/VwapTracker.js";
import { WindowedChange } from "../src/WindowedChange.js";
import { depthImbalance } from "../src/bookImbalance.js";

// ─── RingBuffer ─────────────────────────────────────────────────────────────

describe("RingBuffer - full wrap-around", () => {
  it("handles toArray when buffer wraps and all slots have items", () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    // buffer is now full
    rb.push(4); // overwrites slot 0 (value 1 is gone)
    const arr = rb.toArray();
    expect(arr).toEqual([2, 3, 4]);
  });

  it("exercises the undefined guard in toArray (capacity exceeded path)", () => {
    // After full wrap the start index may land on a slot that has been
    // written, so push enough items to ensure the wrapped path is taken.
    const rb = new RingBuffer<string>(2);
    rb.push("a");
    rb.push("b");
    rb.push("c"); // overwrites "a"
    expect(rb.toArray()).toEqual(["b", "c"]);
  });
});

// ─── RollingVwap ────────────────────────────────────────────────────────────

describe("RollingVwap - value getter", () => {
  it("calls valueAt(Date.now()) via .value", () => {
    const vwap = new RollingVwap(60_000);
    const now = Date.now();
    vwap.addTrade(now - 1000, 200, 5);
    // .value uses Date.now() internally; just verify it's a number
    expect(typeof vwap.value).toBe("number");
    expect(vwap.value).toBeGreaterThan(0);
  });
});

// ─── VwapTracker - sigma edge cases ─────────────────────────────────────────

describe("VwapTracker - variance edge cases", () => {
  it("returns 0 z-score when variance <= 0 (all prices identical)", () => {
    const tracker = new VwapTracker();
    // All trades at the same price → variance = 0
    tracker.addTrade(100, 10).addTrade(100, 5);
    // sigma = 0 → zScore returns 0
    expect(tracker.zScore(110)).toBe(0);
  });
});

// ─── WindowedChange - first.value === 0 ────────────────────────────────────

describe("WindowedChange - first value is zero", () => {
  it("returns 0 when oldest value is 0 and first.value is also 0", () => {
    const tracker = new WindowedChange(60_000);
    const now = Date.now();
    // Add two samples within the window; the first has value 0
    tracker.addSample(now - 2000, 0);
    tracker.addSample(now, 50);
    // oldest is undefined (no sample beyond window), first.value === 0 → returns 0
    expect(tracker.change).toBe(0);
  });
});

// ─── depthImbalance - mid <= 0 ──────────────────────────────────────────────

describe("depthImbalance - mid price is zero or negative", () => {
  it("returns 0 when mid price is <= 0", () => {
    // Bid at 0, ask at 0 → mid = 0
    const result = depthImbalance([[0, 10]], [[0, 5]], 0.01);
    expect(result).toBe(0);
  });

  it("returns 0 when bids and asks are at negative prices", () => {
    // Technically invalid but guards against mid <= 0
    const result = depthImbalance([[-10, 5]], [[-5, 5]], 0.01);
    expect(result).toBe(0);
  });
});

// ─── depthImbalance - total === 0 (line 44 false branch) ────────────────────

describe("depthImbalance - total is zero after filtering", () => {
  it("returns 0 when all bids are below lower bound and all asks are above upper bound", () => {
    // mid = (100 + 101) / 2 = 100.5
    // 0.001% range: ~100.4 to ~100.6
    // bids all at 90 → all below lower → sumBid = 0
    // asks all at 110 → all above upper → sumAsk = 0
    // total = 0 → returns 0
    const result = depthImbalance([[90, 10]], [[110, 10]], 0.00001);
    expect(result).toBe(0);
  });
});
