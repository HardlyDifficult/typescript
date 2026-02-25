import { describe, expect, it } from "vitest";

import { VwapTracker } from "../src/VwapTracker.js";

describe("VwapTracker", () => {
  it("computes VWAP from trades", () => {
    const tracker = new VwapTracker();
    tracker.addTrade(3000, 10).addTrade(3100, 5);

    const expected = (3000 * 10 + 3100 * 5) / (10 + 5);
    expect(tracker.value).toBeCloseTo(expected, 2);
  });

  it("returns 0 before any trades", () => {
    const tracker = new VwapTracker();
    expect(tracker.value).toBe(0);
  });

  it("resets accumulator", () => {
    const tracker = new VwapTracker();
    tracker.addTrade(3000, 10);
    expect(tracker.value).toBe(3000);

    tracker.reset();
    expect(tracker.value).toBe(0);

    tracker.addTrade(3100, 5);
    expect(tracker.value).toBe(3100);
  });

  it("computes z-score", () => {
    const tracker = new VwapTracker();
    tracker.addTrade(3000, 10).addTrade(3100, 5);

    const vwap = (3000 * 10 + 3100 * 5) / 15;
    const sumPV2 = 3000 * 3000 * 10 + 3100 * 3100 * 5;
    const variance = sumPV2 / 15 - vwap * vwap;
    const sigma = Math.sqrt(variance);
    const expected = (3050 - vwap) / sigma;

    expect(tracker.zScore(3050)).toBeCloseTo(expected, 4);
  });

  it("returns z-score 0 before any trades", () => {
    const tracker = new VwapTracker();
    expect(tracker.zScore(3000)).toBe(0);
  });

  it("returns z-score 0 when current price is 0", () => {
    const tracker = new VwapTracker();
    tracker.addTrade(3000, 10);
    expect(tracker.zScore(0)).toBe(0);
  });

  it("supports chaining", () => {
    const tracker = new VwapTracker();
    const result = tracker.addTrade(100, 1).addTrade(200, 1).reset().addTrade(300, 1);
    expect(result).toBe(tracker);
    expect(tracker.value).toBe(300);
  });
});
