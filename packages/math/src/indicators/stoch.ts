/**
 * Stochastic %K indicator.
 * Params: { period: number } (default 14)
 */

import type { Candle } from "../candle.js";
import type { Indicator, IndicatorParams } from "./types.js";

export const stochIndicator: Indicator = {
  type: "stoch",

  compute(candles: Candle[], params: IndicatorParams): number[] {
    const period = Math.max(1, Math.floor(params["period"] ?? 14));
    const out = new Array<number>(candles.length).fill(Number.NaN);

    for (let i = period - 1; i < candles.length; i++) {
      let highest = Number.NEGATIVE_INFINITY;
      let lowest = Number.POSITIVE_INFINITY;
      for (let j = i - period + 1; j <= i; j++) {
        const c = candles[j]!;
        if (c.high > highest) highest = c.high;
        if (c.low < lowest) lowest = c.low;
      }
      const close = candles[i]!.close;
      const range = Math.max(highest - lowest, 1e-9);
      out[i] = ((close - lowest) / range) * 100;
    }

    return out;
  },
};
