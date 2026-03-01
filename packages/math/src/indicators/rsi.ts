/**
 * Relative Strength Index (RSI) indicator.
 * Params: { period: number } (default 14)
 *
 * RSI = 100 - (100 / (1 + RS))
 * RS = average gain / average loss over period
 */

import type { Candle } from "../candle.js";
import type { Indicator } from "./types.js";

export const rsiIndicator: Indicator = {
  type: "rsi",

  compute(candles: Candle[], params: Record<string, number>): number[] {
    const period = params["period"] ?? 14;
    const result: number[] = new Array(candles.length);

    if (candles.length < period + 1) {
      result.fill(NaN);
      return result;
    }

    const changes: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      changes.push(candles[i]!.close - candles[i - 1]!.close);
    }

    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      const change = changes[i]!;
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    for (let i = 0; i <= period; i++) {
      result[i] = NaN;
    }

    result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < candles.length; i++) {
      const change = changes[i - 1]!;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    return result;
  },
};
