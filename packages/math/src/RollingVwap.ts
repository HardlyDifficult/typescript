import { RingBuffer } from "./RingBuffer.js";

interface TradeSample {
  ts: number;
  price: number;
  size: number;
}

export class RollingVwap {
  private readonly buffer: RingBuffer<TradeSample>;
  private readonly windowMs: number;

  constructor(windowMs: number, capacity = 50_000) {
    this.windowMs = windowMs;
    this.buffer = new RingBuffer<TradeSample>(capacity);
  }

  addTrade(ts: number, price: number, size: number): this {
    this.buffer.push({ ts, price, size });
    return this;
  }

  get value(): number {
    return this.valueAt(Date.now());
  }

  valueAt(now: number): number {
    const arr = this.buffer.toArray();
    let pv = 0;
    let v = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (now - arr[i].ts > this.windowMs) {
        break;
      }
      pv += arr[i].price * arr[i].size;
      v += arr[i].size;
    }
    return v > 0 ? pv / v : 0;
  }
}
