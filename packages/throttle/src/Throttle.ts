import { StateTracker } from "@hardlydifficult/state-tracker";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export interface ThrottleSleepInfo {
  weight: number;
  limitPerSecond: number;
  scheduledStart: number;
}

export interface ThrottleOptions {
  unitsPerSecond: number;
  persistKey?: string;
  stateDirectory?: string;
  onSleep?: (delayMs: number, info: ThrottleSleepInfo) => void;
}

/** Rate limiter that enforces a maximum throughput by sleeping between calls, with optional persistent state. */
export class Throttle {
  private nextAvailableAt: number;
  private readonly unitsPerSecond: number;
  private readonly stateTracker?: StateTracker<number>;
  private readonly onSleep?: (delayMs: number, info: ThrottleSleepInfo) => void;

  constructor(options: ThrottleOptions) {
    this.unitsPerSecond = options.unitsPerSecond;
    this.onSleep = options.onSleep;

    if (!Number.isFinite(this.unitsPerSecond) || this.unitsPerSecond <= 0) {
      throw new Error("Throttle requires a positive unitsPerSecond value");
    }

    if (options.persistKey !== undefined) {
      this.stateTracker = new StateTracker({
        key: options.persistKey,
        default: Date.now(),
        stateDirectory: options.stateDirectory,
      });
      this.nextAvailableAt = this.stateTracker.load();
    } else {
      this.nextAvailableAt = 0;
    }
  }

  async wait(weight = 1): Promise<void> {
    if (!Number.isFinite(weight) || weight <= 0) {
      return;
    }

    const now = Date.now();
    const startAt = Math.max(now, this.nextAvailableAt);
    const processingWindowMs = (weight / this.unitsPerSecond) * 1000;
    const delayMs = startAt - now;
    const newNextAvailableAt = startAt + processingWindowMs;

    this.stateTracker?.save(newNextAvailableAt);
    this.nextAvailableAt = newNextAvailableAt;

    if (delayMs > 0) {
      this.onSleep?.(delayMs, {
        weight,
        limitPerSecond: this.unitsPerSecond,
        scheduledStart: startAt,
      });
      await sleep(delayMs);
    }
  }
}
