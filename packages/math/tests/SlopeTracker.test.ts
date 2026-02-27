import { describe, expect, it } from "vitest";

import { SlopeTracker } from "../src/SlopeTracker.js";

describe("SlopeTracker", () => {
  it("returns 0 with no samples", () => {
    const tracker = new SlopeTracker();
    expect(tracker.slope(60_000)).toBe(0);
  });

  it("computes positive slope for increasing values", () => {
    const tracker = new SlopeTracker();
    const base = Date.now() - 30_000;
    for (let i = 0; i < 10; i++) {
      tracker.addSample(base + i * 2000, i * 100);
    }
    expect(tracker.slope(60_000)).toBeGreaterThan(0);
  });

  it("computes negative slope for decreasing values", () => {
    const tracker = new SlopeTracker();
    const base = Date.now() - 30_000;
    for (let i = 0; i < 10; i++) {
      tracker.addSample(base + i * 2000, 1000 - i * 100);
    }
    expect(tracker.slope(60_000)).toBeLessThan(0);
  });

  it("only considers samples within the window", () => {
    const tracker = new SlopeTracker();
    const now = Date.now();

    // Old samples trending down
    tracker.addSample(now - 120_000, 1000);
    tracker.addSample(now - 110_000, 500);

    // Recent samples trending up
    tracker.addSample(now - 5000, 100);
    tracker.addSample(now - 3000, 200);
    tracker.addSample(now - 1000, 300);

    // 10s window should only see the upward trend
    expect(tracker.slope(10_000)).toBeGreaterThan(0);
  });

  it("supports chaining", () => {
    const tracker = new SlopeTracker();
    const result = tracker.addSample(1000, 10).addSample(2000, 20);
    expect(result).toBe(tracker);
  });
});
