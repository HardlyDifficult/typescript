import { describe, expect, it } from "vitest";

import { RegimeClassifier } from "../src/RegimeClassifier.js";
import type { FeatureValues } from "../src/RegimeClassifier.js";

function baseFeatures(overrides: Partial<FeatureValues> = {}): FeatureValues {
  return {
    priceMid: 3000,
    vwapSession: 3000,
    vwap5m: 3000,
    vwapDevZ: 0,
    bookImbalanceTop: 0,
    bookImbalance0p5pct: 0,
    cvdSlope1m: 0,
    cvdSlope5m: 0,
    oiChange15m: 0,
    btcTrend1m: "flat",
    btcTrend5m: "flat",
    nearestLiqClusterDistanceBps: 200,
    ...overrides,
  };
}

describe("RegimeClassifier", () => {
  const classifier = new RegimeClassifier();

  it("classifies chop when all signals are neutral", () => {
    const result = classifier.classify(baseFeatures());
    expect(result.label).toBe("chop");
  });

  it("classifies momentum with strong directional signals", () => {
    const result = classifier.classify(
      baseFeatures({
        vwapDevZ: 2.5,
        bookImbalance0p5pct: 0.4,
        cvdSlope1m: 2000,
        btcTrend1m: "up",
        oiChange15m: 0.03,
      }),
    );
    expect(result.label).toBe("momentum");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("classifies trap when signals contradict price direction", () => {
    const result = classifier.classify(
      baseFeatures({
        vwapDevZ: 2.0,
        bookImbalance0p5pct: -0.4,
        cvdSlope1m: -1500,
        nearestLiqClusterDistanceBps: 30,
        oiChange15m: 0.03,
      }),
    );
    expect(result.label).toBe("trap");
  });

  it("returns confidence between 0 and 1", () => {
    const result = classifier.classify(baseFeatures());
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("all three scores are non-negative", () => {
    const result = classifier.classify(
      baseFeatures({
        vwapDevZ: -1,
        cvdSlope1m: 500,
        bookImbalance0p5pct: -0.2,
      }),
    );
    expect(result.momentumScore).toBeGreaterThanOrEqual(0);
    expect(result.trapScore).toBeGreaterThanOrEqual(0);
    expect(result.chopScore).toBeGreaterThanOrEqual(0);
  });
});
