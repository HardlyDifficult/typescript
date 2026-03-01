/**
 * Indicator interface - all indicators are pure functions: candles in, numbers out.
 */

import type { Candle } from "../candle.js";

/** Parameters for indicator computation. Values may be omitted. */
export type IndicatorParams = Record<string, number | undefined>;

/**
 * A deterministic technical indicator.
 * Computes a series of values from candle data.
 * Returns an array the same length as candles.
 * Earlier values may be NaN if insufficient data for the lookback period.
 */
export interface Indicator {
  /** Unique identifier, e.g. 'sma', 'rsi' */
  readonly type: string;

  /**
   * Compute indicator values from candle data.
   *
   * @param candles - OHLCV data sorted by timestamp ascending
   * @param params - Indicator-specific parameters (e.g. { period: 14 })
   */
  compute(candles: Candle[], params: IndicatorParams): number[];
}
