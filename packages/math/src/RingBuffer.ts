/**
 *
 */
export class RingBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    if (capacity < 1) {
      throw new Error("RingBuffer capacity must be >= 1");
    }
    this.buffer = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  get length(): number {
    return this.count;
  }

  toArray(): T[] {
    if (this.count === 0) {
      return [];
    }
    const start = this.count < this.capacity ? 0 : this.head;
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const item = this.buffer[(start + i) % this.capacity];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  first(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }
    const start = this.count < this.capacity ? 0 : this.head;
    return this.buffer[start];
  }

  last(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }
    return this.buffer[(this.head - 1 + this.capacity) % this.capacity];
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer.fill(undefined);
  }
}
