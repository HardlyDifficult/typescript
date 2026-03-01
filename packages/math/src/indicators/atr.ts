/**
 * ATR (Average True Range) indicator.
 * Params: { period: number } (default 14)
 */

import type { Candle } from "../candle.js";

import type { Indicator, IndicatorParams } from "./types.js";

export const atrIndicator: Indicator = {
  type: "atr",

  compute(candles: Candle[], params: IndicatorParams): number[] {
    const period = Math.max(1, Math.floor(params.period ?? 14));
    if (candles.length === 0) {
      return [];
    }

    const tr: number[] = candles.map((candle, index) => {
      if (index === 0) {
        return candle.high - candle.low;
      }
      const prevClose = candles[index - 1].close;
      const highLow = candle.high - candle.low;
      const highClose = Math.abs(candle.high - prevClose);
      const lowClose = Math.abs(candle.low - prevClose);
      return Math.max(highLow, highClose, lowClose);
    });

    const out = new Array<number>(candles.length).fill(Number.NaN);
    let sum = 0;
    for (let i = 0; i < tr.length; i++) {
      sum += tr[i];
      if (i >= period) {
        sum -= tr[i - period];
      }
      if (i >= period - 1) {
        out[i] = sum / period;
      }
    }

    return out;
  },
};
