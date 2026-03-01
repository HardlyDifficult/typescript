/**
 * Exponential Moving Average (EMA) indicator.
 * Params: { period: number }
 */

import type { Candle } from "../candle.js";
import type { Indicator } from "./types.js";

export const emaIndicator: Indicator = {
  type: "ema",

  compute(candles: Candle[], params: Record<string, number>): number[] {
    const period = params["period"] ?? 14;
    const multiplier = 2 / (period + 1);
    const result: number[] = new Array(candles.length);

    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) {
        result[i] = NaN;
        continue;
      }
      if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += candles[j]!.close;
        }
        result[i] = sum / period;
        continue;
      }
      result[i] = (candles[i]!.close - result[i - 1]!) * multiplier + result[i - 1]!;
    }
    return result;
  },
};
