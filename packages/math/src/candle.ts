/**
 * OHLCV candle data point.
 */
export interface Candle {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
