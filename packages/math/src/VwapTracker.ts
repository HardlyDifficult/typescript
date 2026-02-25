export class VwapTracker {
  private sumPV = 0;
  private sumV = 0;
  private sumPV2 = 0;

  addTrade(price: number, size: number): this {
    this.sumPV += price * size;
    this.sumV += size;
    this.sumPV2 += price * price * size;
    return this;
  }

  reset(): this {
    this.sumPV = 0;
    this.sumV = 0;
    this.sumPV2 = 0;
    return this;
  }

  get value(): number {
    return this.sumV > 0 ? this.sumPV / this.sumV : 0;
  }

  zScore(currentPrice: number): number {
    const vwap = this.value;
    if (vwap === 0 || this.sumV === 0 || currentPrice === 0) {
      return 0;
    }
    const variance = this.sumPV2 / this.sumV - vwap * vwap;
    const sigma = variance > 0 ? Math.sqrt(variance) : 0;
    return sigma > 0 ? (currentPrice - vwap) / sigma : 0;
  }
}
