import { describe, expect, it } from "vitest";

import { RollingVwap } from "../src/RollingVwap.js";

describe("RollingVwap", () => {
  it("returns 0 before any trades", () => {
    const vwap = new RollingVwap(5 * 60 * 1000);
    expect(vwap.valueAt(Date.now())).toBe(0);
  });

  it("computes VWAP from recent trades", () => {
    const vwap = new RollingVwap(5 * 60 * 1000);
    const now = Date.now();

    vwap.addTrade(now - 1000, 3000, 10).addTrade(now - 500, 3100, 5);

    const expected = (3000 * 10 + 3100 * 5) / (10 + 5);
    expect(vwap.valueAt(now)).toBeCloseTo(expected, 2);
  });

  it("excludes trades outside the window", () => {
    const windowMs = 5 * 60 * 1000;
    const vwap = new RollingVwap(windowMs);
    const now = Date.now();

    // Old trade outside window
    vwap.addTrade(now - windowMs - 10_000, 2000, 100);
    // Recent trades inside window
    vwap.addTrade(now - 1000, 3000, 10);
    vwap.addTrade(now - 500, 3100, 5);

    const expected = (3000 * 10 + 3100 * 5) / (10 + 5);
    expect(vwap.valueAt(now)).toBeCloseTo(expected, 2);
  });

  it("supports chaining", () => {
    const vwap = new RollingVwap(60_000);
    const result = vwap.addTrade(Date.now(), 100, 1);
    expect(result).toBe(vwap);
  });
});
