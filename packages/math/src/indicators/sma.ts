/**
 * Simple Moving Average (SMA) indicator.
 * Params: { period: number }
 */

import type { Candle } from "../candle.js";
import type { Indicator } from "./types.js";

export const smaIndicator: Indicator = {
  type: "sma",

  compute(candles: Candle[], params: Record<string, number>): number[] {
    const period = params["period"] ?? 14;
    const result: number[] = new Array(candles.length);

    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) {
        result[i] = NaN;
        continue;
      }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j]!.close;
      }
      result[i] = sum / period;
    }
    return result;
  },
};
