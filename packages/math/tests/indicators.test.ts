import { describe, expect, it } from "vitest";

import type { Candle } from "../src/candle.js";
import {
  getAvailableIndicators,
  getIndicator,
  smaIndicator,
  emaIndicator,
  rsiIndicator,
  macdIndicator,
  bollingerIndicator,
  rocIndicator,
  atrIndicator,
  stochIndicator,
  obvIndicator,
} from "../src/indicators/index.js";

/** Generate synthetic candles for testing. Prices go 100, 101, 102, ... */
function makeCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: 1000 + i * 60_000,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100 + i + 0.5,
    volume: 1000 + i * 10,
  }));
}

/** Candles with a known up-down pattern for RSI/OBV testing */
function makeZigzagCandles(n: number): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const change = i % 2 === 0 ? 2 : -1;
    price += change;
    candles.push({
      timestamp: 1000 + i * 60_000,
      open: price - change * 0.5,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 1000,
    });
  }
  return candles;
}

describe("indicator registry", () => {
  it("has all 10 built-in indicators registered", () => {
    const available = getAvailableIndicators();
    expect(available).toContain("sma");
    expect(available).toContain("ema");
    expect(available).toContain("rsi");
    expect(available).toContain("macd");
    expect(available).toContain("macd_signal");
    expect(available).toContain("bollinger");
    expect(available).toContain("roc");
    expect(available).toContain("atr");
    expect(available).toContain("stoch");
    expect(available).toContain("obv");
    expect(available.length).toBe(10);
  });

  it("getIndicator returns correct indicator", () => {
    expect(getIndicator("sma").type).toBe("sma");
    expect(getIndicator("rsi").type).toBe("rsi");
  });

  it("throws on unknown indicator", () => {
    expect(() => getIndicator("nonexistent")).toThrow("Unknown indicator type");
  });
});

describe("SMA", () => {
  it("computes correctly with period 3", () => {
    const candles = makeCandles(5);
    const result = smaIndicator.compute(candles, { period: 3 });
    expect(result.length).toBe(5);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeCloseTo((100.5 + 101.5 + 102.5) / 3);
    expect(result[3]).toBeCloseTo((101.5 + 102.5 + 103.5) / 3);
  });
});

describe("EMA", () => {
  it("first EMA value equals SMA", () => {
    const candles = makeCandles(5);
    const ema = emaIndicator.compute(candles, { period: 3 });
    const sma = smaIndicator.compute(candles, { period: 3 });
    expect(ema[2]).toBeCloseTo(sma[2]!);
  });

  it("returns NaN for insufficient data", () => {
    const candles = makeCandles(2);
    const result = emaIndicator.compute(candles, { period: 3 });
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
  });
});

describe("RSI", () => {
  it("returns values between 0 and 100", () => {
    const candles = makeZigzagCandles(30);
    const result = rsiIndicator.compute(candles, { period: 14 });
    for (let i = 15; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(0);
      expect(result[i]).toBeLessThanOrEqual(100);
    }
  });

  it("returns NaN for insufficient data", () => {
    const candles = makeCandles(10);
    const result = rsiIndicator.compute(candles, { period: 14 });
    // Array has 10 elements (indices 0-9), all should be NaN
    expect(result.length).toBe(10);
    for (const val of result) {
      expect(val).toBeNaN();
    }
  });
});

describe("MACD", () => {
  it("output length matches input length", () => {
    const candles = makeCandles(50);
    const result = macdIndicator.compute(candles, {});
    expect(result.length).toBe(50);
  });
});

describe("Bollinger", () => {
  it("returns %B around 0.5 for steady prices", () => {
    // Constant price candles
    const candles: Candle[] = Array.from({ length: 25 }, (_, i) => ({
      timestamp: i * 60_000,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1000,
    }));
    const result = bollingerIndicator.compute(candles, { period: 20 });
    // When stdDev = 0, bandwidth = 0, %B defaults to 0.5
    expect(result[24]).toBeCloseTo(0.5);
  });
});

describe("ROC", () => {
  it("computes rate of change as percentage", () => {
    const candles = makeCandles(20);
    const result = rocIndicator.compute(candles, { period: 5 });
    expect(result[4]).toBeNaN();
    expect(result[5]).toBeDefined();
    // close[5]=105.5, close[0]=100.5 => ROC = (105.5-100.5)/100.5*100
    expect(result[5]).toBeCloseTo((5 / 100.5) * 100);
  });
});

describe("ATR", () => {
  it("returns NaN before period, then valid values", () => {
    const candles = makeCandles(20);
    const result = atrIndicator.compute(candles, { period: 5 });
    for (let i = 0; i < 4; i++) {
      expect(result[i]).toBeNaN();
    }
    expect(result[4]).not.toBeNaN();
    expect(result[4]! > 0).toBe(true);
  });
});

describe("Stochastic", () => {
  it("returns values between 0 and 100", () => {
    const candles = makeZigzagCandles(30);
    const result = stochIndicator.compute(candles, { period: 14 });
    for (let i = 13; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(0);
      expect(result[i]).toBeLessThanOrEqual(100);
    }
  });
});

describe("OBV", () => {
  it("starts at 0 and accumulates", () => {
    const candles = makeCandles(5); // monotonically increasing prices
    const result = obvIndicator.compute(candles, {});
    expect(result[0]).toBe(0);
    // Each subsequent candle has higher close, so volume is added
    expect(result[1]! > 0).toBe(true);
    expect(result[4]! > result[3]!).toBe(true);
  });
});
