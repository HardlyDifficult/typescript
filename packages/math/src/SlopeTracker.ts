import { computeSlope, type Sample } from "./linearRegression.js";
import { RingBuffer } from "./RingBuffer.js";

interface TimestampedValue {
  ts: number;
  value: number;
}

/**
 *
 */
export class SlopeTracker {
  private readonly buffer: RingBuffer<TimestampedValue>;

  constructor(capacity = 600) {
    this.buffer = new RingBuffer<TimestampedValue>(capacity);
  }

  addSample(ts: number, value: number): this {
    this.buffer.push({ ts, value });
    return this;
  }

  slope(windowMs: number): number {
    const arr = this.buffer.toArray();
    if (arr.length < 2) {
      return 0;
    }

    const cutoff = arr[arr.length - 1].ts - windowMs;
    const windowSamples: Sample[] = [];
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].ts < cutoff) {
        break;
      }
      windowSamples.push({ t: arr[i].ts, v: arr[i].value });
    }

    windowSamples.reverse();
    return computeSlope(windowSamples);
  }
}
