/**
 * MACD (Moving Average Convergence Divergence) indicator.
 * Params: { fast: number, slow: number, signal: number }
 * Defaults: fast=12, slow=26, signal=9
 *
 * macd returns the histogram (MACD line - signal line).
 * macd_signal returns the signal line.
 */

import type { Candle } from "../candle.js";

import type { Indicator, IndicatorParams } from "./types.js";

function computeEMA(values: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const result = new Array<number>(values.length);

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (isNaN(val)) {
      result[i] = NaN;
      continue;
    }
    if (i === 0) {
      result[i] = val;
      continue;
    }
    const prev = result[i - 1];
    if (isNaN(prev)) {
      result[i] = val;
      continue;
    }
    result[i] = (val - prev) * multiplier + prev;
  }
  return result;
}

function computeMacdLines(candles: Candle[], params: IndicatorParams) {
  const fast = params.fast ?? 12;
  const slow = params.slow ?? 26;

  const closes = candles.map((c) => c.close);
  const fastEMA = computeEMA(closes, fast);
  const slowEMA = computeEMA(closes, slow);

  const macdLine = new Array<number>(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const f = fastEMA[i];
    const s = slowEMA[i];
    macdLine[i] = isNaN(f) || isNaN(s) ? NaN : f - s;
  }

  return macdLine;
}

export const macdIndicator: Indicator = {
  type: "macd",

  compute(candles: Candle[], params: IndicatorParams): number[] {
    const signalPeriod = params.signal ?? 9;
    const macdLine = computeMacdLines(candles, params);
    const signalLine = computeEMA(macdLine, signalPeriod);

    const result = new Array<number>(candles.length);
    for (let i = 0; i < candles.length; i++) {
      const m = macdLine[i];
      const sig = signalLine[i];
      result[i] = isNaN(m) || isNaN(sig) ? NaN : m - sig;
    }

    return result;
  },
};

export const macdSignalIndicator: Indicator = {
  type: "macd_signal",

  compute(candles: Candle[], params: IndicatorParams): number[] {
    const signalPeriod = params.signal ?? 9;
    const macdLine = computeMacdLines(candles, params);
    return computeEMA(macdLine, signalPeriod);
  },
};
