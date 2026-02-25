export type Level = readonly [price: number, size: number];

export function bookImbalance(bidSize: number, askSize: number): number {
  const total = bidSize + askSize;
  return total > 0 ? (bidSize - askSize) / total : 0;
}

export function depthImbalance(
  bids: readonly Level[],
  asks: readonly Level[],
  depthPct: number,
): number {
  if (bids.length === 0 || asks.length === 0) {
    return 0;
  }

  const mid = (bids[0][0] + asks[0][0]) / 2;
  if (mid <= 0) {
    return 0;
  }

  const lower = mid * (1 - depthPct);
  const upper = mid * (1 + depthPct);

  let sumBid = 0;
  for (const [px, sz] of bids) {
    if (px < lower) {
      break;
    }
    sumBid += sz;
  }

  let sumAsk = 0;
  for (const [px, sz] of asks) {
    if (px > upper) {
      break;
    }
    sumAsk += sz;
  }

  const total = sumBid + sumAsk;
  return total > 0 ? (sumBid - sumAsk) / total : 0;
}
