import { describe, expect, it } from "vitest";

import { computeSlope } from "../src/linearRegression.js";

describe("computeSlope", () => {
  it("returns 0 for fewer than 2 samples", () => {
    expect(computeSlope([])).toBe(0);
    expect(computeSlope([{ t: 1000, v: 5 }])).toBe(0);
  });

  it("computes positive slope for increasing values", () => {
    const samples = [
      { t: 0, v: 0 },
      { t: 1000, v: 10 },
      { t: 2000, v: 20 },
    ];
    const slope = computeSlope(samples);
    expect(slope).toBeCloseTo(10, 5);
  });

  it("computes negative slope for decreasing values", () => {
    const samples = [
      { t: 0, v: 20 },
      { t: 1000, v: 10 },
      { t: 2000, v: 0 },
    ];
    const slope = computeSlope(samples);
    expect(slope).toBeCloseTo(-10, 5);
  });

  it("returns 0 for constant values", () => {
    const samples = [
      { t: 0, v: 5 },
      { t: 1000, v: 5 },
      { t: 2000, v: 5 },
    ];
    expect(computeSlope(samples)).toBeCloseTo(0, 10);
  });

  it("handles two samples", () => {
    const slope = computeSlope([
      { t: 0, v: 0 },
      { t: 2000, v: 100 },
    ]);
    expect(slope).toBeCloseTo(50, 5);
  });

  it("returns 0 when all timestamps are the same", () => {
    const samples = [
      { t: 1000, v: 1 },
      { t: 1000, v: 2 },
    ];
    expect(computeSlope(samples)).toBe(0);
  });
});
