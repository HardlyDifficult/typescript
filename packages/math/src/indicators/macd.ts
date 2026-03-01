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
    if (val === undefined || isNaN(val)) {
      result[i] = NaN;
      continue;
    }
    const prev = i > 0 ? result[i - 1] : undefined;
    if (prev === undefined || isNaN(prev)) {
      result[i] = val;
      continue;
    }
    result[i] = (val - prev) * multiplier + prev;
  }
  return result;
}

export const macdIndicator: Indicator = {
  type: "macd",

  compute(candles: Candle[], params: IndicatorParams): number[] {
    const fast = params["fast"] ?? 12;
    const slow = params["slow"] ?? 26;
    const signalPeriod = params["signal"] ?? 9;

    const closes = candles.map((c) => c.close);
    const fastEMA = computeEMA(closes, fast);
    const slowEMA = computeEMA(closes, slow);

    const macdLine = new Array<number>(candles.length);
    for (let i = 0; i < candles.length; i++) {
      const f = fastEMA[i];
      const s = slowEMA[i];
      if (f === undefined || s === undefined || isNaN(f) || isNaN(s)) {
        macdLine[i] = NaN;
      } else {
        macdLine[i] = f - s;
      }
    }

    const signalLine = computeEMA(macdLine, signalPeriod);

    const result = new Array<number>(candles.length);
    for (let i = 0; i < candles.length; i++) {
      const m = macdLine[i];
      const sig = signalLine[i];
      if (m === undefined || sig === undefined || isNaN(m) || isNaN(sig)) {
        result[i] = NaN;
      } else {
        result[i] = m - sig;
      }
    }

    return result;
  },
};

export const macdSignalIndicator: Indicator = {
  type: "macd_signal",

  compute(candles: Candle[], params: IndicatorParams): number[] {
    const fast = params["fast"] ?? 12;
    const slow = params["slow"] ?? 26;
    const signalPeriod = params["signal"] ?? 9;

    const closes = candles.map((c) => c.close);
    const fastEMA = computeEMA(closes, fast);
    const slowEMA = computeEMA(closes, slow);

    const macdLine = new Array<number>(candles.length);
    for (let i = 0; i < candles.length; i++) {
      const f = fastEMA[i];
      const s = slowEMA[i];
      if (f === undefined || s === undefined || isNaN(f) || isNaN(s)) {
        macdLine[i] = NaN;
      } else {
        macdLine[i] = f - s;
      }
    }

    return computeEMA(macdLine, signalPeriod);
  },
};
