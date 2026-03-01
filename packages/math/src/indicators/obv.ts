/**
 * OBV (On-Balance Volume) indicator.
 *
 * Running total: adds volume when close > prev close, subtracts when close < prev close.
 */

import type { Candle } from "../candle.js";
import type { Indicator, IndicatorParams } from "./types.js";

export const obvIndicator: Indicator = {
  type: "obv",

  compute(candles: Candle[], _params: IndicatorParams): number[] {
    const out = new Array<number>(candles.length).fill(Number.NaN);
    if (candles.length === 0) return out;
    out[0] = 0;
    for (let i = 1; i < candles.length; i++) {
      const curr = candles[i]!;
      const prev = candles[i - 1]!;
      let delta = 0;
      if (curr.close > prev.close) {
        delta = curr.volume;
      } else if (curr.close < prev.close) {
        delta = -curr.volume;
      }
      out[i] = out[i - 1]! + delta;
    }
    return out;
  },
};
