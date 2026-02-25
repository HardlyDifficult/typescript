import { describe, expect, it } from "vitest";

import { bookImbalance, depthImbalance } from "../src/bookImbalance.js";

describe("bookImbalance", () => {
  it("returns positive for bid-heavy book", () => {
    expect(bookImbalance(20, 10)).toBeCloseTo((20 - 10) / (20 + 10), 5);
  });

  it("returns 0 for balanced book", () => {
    expect(bookImbalance(10, 10)).toBeCloseTo(0, 5);
  });

  it("returns negative for ask-heavy book", () => {
    expect(bookImbalance(5, 15)).toBeCloseTo((5 - 15) / (5 + 15), 5);
  });

  it("returns 0 when both sizes are 0", () => {
    expect(bookImbalance(0, 0)).toBe(0);
  });
});

describe("depthImbalance", () => {
  it("computes imbalance within depth range", () => {
    // mid = (3000 + 3001) / 2 = 3000.5
    // 0.5% range: ~2985.5 to ~3015.5
    // bids in range: 3000 (15) + 2990 (10) = 25
    // asks in range: 3001 (5) + 3010 (3) = 8
    const bids: [number, number][] = [
      [3000, 15],
      [2990, 10],
      [2980, 5],
    ];
    const asks: [number, number][] = [
      [3001, 5],
      [3010, 3],
      [3020, 3],
    ];

    expect(depthImbalance(bids, asks, 0.005)).toBeCloseTo(17 / 33, 4);
  });

  it("returns 0 for empty books", () => {
    expect(depthImbalance([], [[3000, 10]], 0.005)).toBe(0);
    expect(depthImbalance([[3000, 10]], [], 0.005)).toBe(0);
  });

  it("excludes levels outside depth range", () => {
    // mid = (100 + 101) / 2 = 100.5
    // 1% range: 99.495 to 101.505
    const bids: [number, number][] = [
      [100, 10],
      [98, 50], // outside range
    ];
    const asks: [number, number][] = [
      [101, 10],
      [103, 50], // outside range
    ];

    expect(depthImbalance(bids, asks, 0.01)).toBeCloseTo(0, 5);
  });
});
