import { RingBuffer } from "./RingBuffer.js";

interface TimestampedValue {
  ts: number;
  value: number;
}

export class WindowedChange {
  private readonly buffer: RingBuffer<TimestampedValue>;
  private readonly windowMs: number;

  constructor(windowMs: number, capacity = 240) {
    this.windowMs = windowMs;
    this.buffer = new RingBuffer<TimestampedValue>(capacity);
  }

  addSample(ts: number, value: number): this {
    this.buffer.push({ ts, value });
    return this;
  }

  get change(): number {
    const arr = this.buffer.toArray();
    if (arr.length < 2) {
      return 0;
    }

    const latest = arr[arr.length - 1];
    const cutoff = latest.ts - this.windowMs;

    let oldest: TimestampedValue | undefined;
    for (const sample of arr) {
      if (sample.ts <= cutoff) {
        oldest = sample;
      } else {
        break;
      }
    }

    if (!oldest || oldest.value === 0) {
      const first = arr[0];
      if (first.value === 0) {
        return 0;
      }
      return (latest.value - first.value) / first.value;
    }

    return (latest.value - oldest.value) / oldest.value;
  }
}
