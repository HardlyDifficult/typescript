/**
 * Bollinger Bands indicator.
 * Params: { period: number, stdDev: number }
 * Defaults: period=20, stdDev=2
 *
 * Returns the %B value: (price - lower) / (upper - lower)
 */

import type { Candle } from "../candle.js";
import type { Indicator, IndicatorParams } from "./types.js";

export const bollingerIndicator: Indicator = {
  type: "bollinger",

  compute(candles: Candle[], params: IndicatorParams): number[] {
    const period = params["period"] ?? 20;
    const stdDevMult = params["stdDev"] ?? 2;
    const result = new Array<number>(candles.length);

    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) {
        result[i] = NaN;
        continue;
      }

      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j]!.close;
      }
      const sma = sum / period;

      let sqSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sqSum += (candles[j]!.close - sma) ** 2;
      }
      const stdDev = Math.sqrt(sqSum / period);

      const upper = sma + stdDevMult * stdDev;
      const lower = sma - stdDevMult * stdDev;
      const bandwidth = upper - lower;

      result[i] = bandwidth === 0 ? 0.5 : (candles[i]!.close - lower) / bandwidth;
    }

    return result;
  },
};
