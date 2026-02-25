import { describe, expect, it } from "vitest";

import { WindowedChange } from "../src/WindowedChange.js";

describe("WindowedChange", () => {
  it("returns 0 with no data", () => {
    const tracker = new WindowedChange(15 * 60 * 1000);
    expect(tracker.change).toBe(0);
  });

  it("returns 0 with single sample", () => {
    const tracker = new WindowedChange(15 * 60 * 1000);
    tracker.addSample(Date.now(), 100000);
    expect(tracker.change).toBe(0);
  });

  it("computes percent change over available window", () => {
    const tracker = new WindowedChange(15 * 60 * 1000);
    const now = Date.now();
    tracker.addSample(now - 60_000, 100000);
    tracker.addSample(now, 102000);

    expect(tracker.change).toBeCloseTo(0.02, 5);
  });

  it("uses the sample closest to the window boundary", () => {
    const fifteenMin = 15 * 60 * 1000;
    const tracker = new WindowedChange(fifteenMin);
    const now = Date.now();

    tracker.addSample(now - fifteenMin - 60_000, 100000);
    tracker.addSample(now - fifteenMin, 101000);
    tracker.addSample(now, 105000);

    expect(tracker.change).toBeCloseTo((105000 - 101000) / 101000, 3);
  });

  it("supports chaining", () => {
    const tracker = new WindowedChange(60_000);
    const result = tracker.addSample(1000, 100).addSample(2000, 200);
    expect(result).toBe(tracker);
  });
});
