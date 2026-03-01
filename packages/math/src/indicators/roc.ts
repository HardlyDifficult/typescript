/**
 * Rate of Change (ROC) indicator.
 * Params: { period: number } (default 14)
 *
 * ROC = ((current - previous) / previous) * 100
 */

import type { Candle } from "../candle.js";

import type { Indicator, IndicatorParams } from "./types.js";

export const rocIndicator: Indicator = {
  type: "roc",

  compute(candles: Candle[], params: IndicatorParams): number[] {
    const period = params.period ?? 14;
    const result = new Array<number>(candles.length);

    for (let i = 0; i < candles.length; i++) {
      if (i < period) {
        result[i] = NaN;
        continue;
      }
      const previous = candles[i - period].close;
      if (previous === 0) {
        result[i] = 0;
        continue;
      }
      result[i] = ((candles[i].close - previous) / previous) * 100;
    }

    return result;
  },
};
