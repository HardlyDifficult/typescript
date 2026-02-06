import { type TimeSpan, toMilliseconds } from "@hardlydifficult/date-time";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export interface ThrottleOptions {
  minimumDelay: TimeSpan;
  onSleep?: (ms: number) => void;
}

export class Throttle {
  private lastTimestamp = 0;
  private readonly minimumDelayMs: number;
  private readonly onSleep?: (ms: number) => void;

  constructor(options: ThrottleOptions) {
    this.minimumDelayMs = toMilliseconds(options.minimumDelay);
    if (this.minimumDelayMs <= 0) {
      throw new Error("Throttle minimumDelay must be a positive duration");
    }
    this.onSleep = options.onSleep;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const target = Math.max(now, this.lastTimestamp + this.minimumDelayMs);
    const delay = target - now;

    this.lastTimestamp = target;

    if (delay > 0) {
      this.onSleep?.(delay);
      await sleep(delay);
    }
  }
}
