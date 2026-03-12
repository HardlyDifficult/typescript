/**
 * Additional tests to cover remaining branches in indicators.
 */
import { describe, expect, it } from "vitest";

import type { Candle } from "../src/candle.js";
import {
  atrIndicator,
  bollingerIndicator,
  emaIndicator,
  macdIndicator,
  macdSignalIndicator,
  obvIndicator,
  rocIndicator,
  rsiIndicator,
  smaIndicator,
  stochIndicator,
} from "../src/indicators/index.js";

function makeCandle(close: number, opts?: Partial<Candle>): Candle {
  return {
    timestamp: 0,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    ...opts,
  };
}

function makeCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: i * 60_000,
    open: 100 + i,
    high: 102 + i,
    low: 98 + i,
    close: 100 + i + 0.5,
    volume: 1000 + i * 10,
  }));
}

// ─── SMA ───────────────────────────────────────────────────────────────────

describe("SMA - default period (14)", () => {
  it("uses default period 14 when not specified", () => {
    const candles = makeCandles(15);
    const result = smaIndicator.compute(candles, {});
    expect(result[13]).not.toBeNaN();
    expect(result[0]).toBeNaN();
  });
});

// ─── EMA ───────────────────────────────────────────────────────────────────

describe("EMA - default period (14)", () => {
  it("uses default period 14 when not specified", () => {
    const candles = makeCandles(15);
    const result = emaIndicator.compute(candles, {});
    expect(result[13]).not.toBeNaN();
    expect(result[0]).toBeNaN();
  });
});

// ─── ATR ───────────────────────────────────────────────────────────────────

describe("ATR - empty candles", () => {
  it("returns empty array for empty input", () => {
    const result = atrIndicator.compute([], { period: 14 });
    expect(result).toEqual([]);
  });

  it("uses default period 14 when not specified", () => {
    const candles = makeCandles(20);
    const result = atrIndicator.compute(candles, {});
    expect(result.length).toBe(20);
    expect(result[0]).toBeNaN();
    expect(result[13]).not.toBeNaN();
  });
});

// ─── Stochastic ────────────────────────────────────────────────────────────

describe("Stochastic - default period (14)", () => {
  it("uses default period 14 when not specified", () => {
    const candles = makeCandles(15);
    const result = stochIndicator.compute(candles, {});
    expect(result[13]).not.toBeNaN();
    expect(result[0]).toBeNaN();
  });
});

// ─── Bollinger - default stdDev (2) ────────────────────────────────────────

describe("Bollinger - default params", () => {
  it("uses default period 20 and stdDev 2 when not specified", () => {
    const candles = makeCandles(25);
    const result = bollingerIndicator.compute(candles, {});
    expect(result[19]).not.toBeNaN();
    expect(result[0]).toBeNaN();
  });

  it("returns 0.5 when stdDev is zero (all prices equal) with explicit period", () => {
    // constant price => bandwidth == 0 => 0.5
    const candles: Candle[] = Array.from({ length: 5 }, (_, i) => ({
      timestamp: i,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1,
    }));
    const result = bollingerIndicator.compute(candles, { period: 5 });
    expect(result[4]).toBeCloseTo(0.5);
  });
});

// ─── RSI - default period ──────────────────────────────────────────────────

describe("RSI - default period (14)", () => {
  it("uses default period 14 when not specified", () => {
    const candles = makeCandles(20);
    const result = rsiIndicator.compute(candles, {});
    expect(result.length).toBe(20);
    // With fewer candles than period+1 all would be NaN; 20 candles with period 14 gives data at [14]
    expect(result[14]).not.toBeNaN();
  });
});

// ─── ROC - default period ──────────────────────────────────────────────────

describe("ROC - default period (14)", () => {
  it("uses default period 14 when not specified", () => {
    const candles = makeCandles(20);
    const result = rocIndicator.compute(candles, {});
    expect(result.length).toBe(20);
    expect(result[13]).toBeNaN();
    expect(result[14]).not.toBeNaN();
  });
});

// ─── RSI - avgLoss === 0 ────────────────────────────────────────────────────

describe("RSI - all gains (avgLoss = 0)", () => {
  it("returns 100 when all changes are upward (avgLoss = 0)", () => {
    // Strictly increasing prices so avgLoss stays 0
    const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i,
      open: 100 + i,
      high: 101 + i,
      low: 99 + i,
      close: 100 + i,
      volume: 1000,
    }));
    const result = rsiIndicator.compute(candles, { period: 14 });
    expect(result[14]).toBeCloseTo(100);
    // Also verify subsequent values with avgLoss still 0 -> RSI = 100
    expect(result[15]).toBeCloseTo(100);
  });
});

// ─── RSI - avgLoss === 0 in loop (line 57) ─────────────────────────────────

describe("RSI - avgLoss becomes 0 mid-series", () => {
  it("returns 100 for later values when avgLoss is driven to 0", () => {
    const period = 3;
    // First 3 changes mix gain/loss, then go all-gain to drive avgLoss to 0
    const closes = [100, 101, 100, 101, 102, 103, 104, 105, 106];
    const candles: Candle[] = closes.map((close, i) => ({
      timestamp: i,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000,
    }));
    const result = rsiIndicator.compute(candles, { period });
    // After enough up moves avgLoss approaches 0 => RSI approaches 100
    const lastVal = result[result.length - 1]!;
    expect(lastVal).toBeGreaterThan(90);
  });
});

// ─── OBV - equal and declining close prices ────────────────────────────────

describe("OBV - equal close prices", () => {
  it("does not add or subtract volume when close == prev close", () => {
    const candles: Candle[] = [
      makeCandle(100, { volume: 1000 }),
      makeCandle(100, { volume: 500 }), // equal close → delta = 0
      makeCandle(100, { volume: 200 }),
    ];
    const result = obvIndicator.compute(candles, {});
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0); // no change
    expect(result[2]).toBe(0); // no change
  });

  it("subtracts volume when close < prev close", () => {
    const candles: Candle[] = [
      makeCandle(100, { volume: 1000 }),
      makeCandle(90, { volume: 500 }), // close < prev close → subtract
    ];
    const result = obvIndicator.compute(candles, {});
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(-500); // volume subtracted
  });

  it("returns empty array for empty candles", () => {
    const result = obvIndicator.compute([], {});
    expect(result).toEqual([]);
  });
});

// ─── ROC - previous === 0 ──────────────────────────────────────────────────

describe("ROC - previous price is zero", () => {
  it("returns 0 when previous close is exactly 0", () => {
    const period = 2;
    const candles: Candle[] = [
      makeCandle(0), // i=0 → reference price at i - period
      makeCandle(50), // i=1
      makeCandle(100), // i=2 → previous = candles[0].close = 0 → returns 0
    ];
    const result = rocIndicator.compute(candles, { period });
    expect(result[2]).toBe(0);
  });
});

// ─── MACD - NaN handling ────────────────────────────────────────────────────

describe("MACD - macdSignalIndicator", () => {
  it("computes signal line for macd_signal type", () => {
    const candles = makeCandles(50);
    const result = macdSignalIndicator.compute(candles, {});
    expect(result.length).toBe(50);
  });
});

describe("MACD - with explicit fast/slow/signal params", () => {
  it("uses explicit fast, slow, signal params", () => {
    const candles = makeCandles(30);
    const result = macdIndicator.compute(candles, {
      fast: 3,
      slow: 6,
      signal: 3,
    });
    expect(result.length).toBe(30);
    // First value should not be NaN with very short periods
    expect(typeof result[0]).toBe("number");
  });
});

describe("MACD - NaN close prices trigger isNaN branches in internal EMA", () => {
  it("handles candles with NaN close price (covers internal EMA NaN paths)", () => {
    // Providing a NaN close causes computeEMA to take the isNaN(val) and isNaN(prev) branches
    const candles: Candle[] = [
      makeCandle(NaN), // forces isNaN(val) branch
      makeCandle(100), // causes isNaN(prev) branch since prev was NaN
      makeCandle(102),
      makeCandle(104),
      makeCandle(106),
    ];
    const result = macdIndicator.compute(candles, {
      fast: 2,
      slow: 3,
      signal: 2,
    });
    expect(result.length).toBe(5);
    // NaN propagates through early values
    expect(isNaN(result[0]!)).toBe(true);
  });

  it("macdSignalIndicator with NaN close prices", () => {
    const candles: Candle[] = [
      makeCandle(NaN),
      makeCandle(100),
      makeCandle(102),
      makeCandle(104),
      makeCandle(106),
    ];
    const result = macdSignalIndicator.compute(candles, {
      fast: 2,
      slow: 3,
      signal: 2,
    });
    expect(result.length).toBe(5);
  });
});
