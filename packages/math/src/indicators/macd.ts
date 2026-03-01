/**
 * MACD (Moving Average Convergence Divergence) indicator.
 * Params: { fast: number, slow: number, signal: number }
 * Defaults: fast=12, slow=26, signal=9
 *
 * macd returns the histogram (MACD line - signal line).
 * macd_signal returns the signal line.
 */

import type { Candle } from "../candle.js";
import type { Indicator } from "./types.js";

function computeEMA(values: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const result: number[] = new Array(values.length);

  for (let i = 0; i < values.length; i++) {
    if (isNaN(values[i]!)) {
      result[i] = NaN;
      continue;
    }
    if (i === 0 || isNaN(result[i - 1]!)) {
      result[i] = values[i]!;
      continue;
    }
    result[i] = (values[i]! - result[i - 1]!) * multiplier + result[i - 1]!;
  }
  return result;
}

export const macdIndicator: Indicator = {
  type: "macd",

  compute(candles: Candle[], params: Record<string, number>): number[] {
    const fast = params["fast"] ?? 12;
    const slow = params["slow"] ?? 26;
    const signalPeriod = params["signal"] ?? 9;

    const closes = candles.map((c) => c.close);
    const fastEMA = computeEMA(closes, fast);
    const slowEMA = computeEMA(closes, slow);

    const macdLine: number[] = new Array(candles.length);
    for (let i = 0; i < candles.length; i++) {
      if (isNaN(fastEMA[i]!) || isNaN(slowEMA[i]!)) {
        macdLine[i] = NaN;
      } else {
        macdLine[i] = fastEMA[i]! - slowEMA[i]!;
      }
    }

    const signalLine = computeEMA(macdLine, signalPeriod);

    const result: number[] = new Array(candles.length);
    for (let i = 0; i < candles.length; i++) {
      if (isNaN(macdLine[i]!) || isNaN(signalLine[i]!)) {
        result[i] = NaN;
      } else {
        result[i] = macdLine[i]! - signalLine[i]!;
      }
    }

    return result;
  },
};

export const macdSignalIndicator: Indicator = {
  type: "macd_signal",

  compute(candles: Candle[], params: Record<string, number>): number[] {
    const fast = params["fast"] ?? 12;
    const slow = params["slow"] ?? 26;
    const signalPeriod = params["signal"] ?? 9;

    const closes = candles.map((c) => c.close);
    const fastEMA = computeEMA(closes, fast);
    const slowEMA = computeEMA(closes, slow);

    const macdLine: number[] = new Array(candles.length);
    for (let i = 0; i < candles.length; i++) {
      if (isNaN(fastEMA[i]!) || isNaN(slowEMA[i]!)) {
        macdLine[i] = NaN;
      } else {
        macdLine[i] = fastEMA[i]! - slowEMA[i]!;
      }
    }

    return computeEMA(macdLine, signalPeriod);
  },
};
