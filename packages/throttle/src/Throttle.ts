import { duration } from "@hardlydifficult/date-time";
import {
  StateTracker,
  type StorageAdapter,
} from "@hardlydifficult/state-tracker";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export interface ThrottleDelayInfo {
  weight: number;
  perSecond: number;
  scheduledStart: number;
}

export interface ThrottleOptions {
  perSecond: number;
  name?: string;
  stateDirectory?: string;
  storageAdapter?: StorageAdapter;
  onDelay?: (delayMs: number, info: ThrottleDelayInfo) => void;
}

/** Rate limiter that enforces a maximum throughput by sleeping between calls, with optional persistent state. */
export class Throttle {
  private nextAvailableAt: number;
  private readonly perSecond: number;
  private readonly stateTracker?: StateTracker<number>;
  private readonly onDelay?: (delayMs: number, info: ThrottleDelayInfo) => void;
  private stateLoaded = false;

  constructor(options: ThrottleOptions) {
    this.perSecond = options.perSecond;
    this.onDelay = options.onDelay;

    if (!Number.isFinite(this.perSecond) || this.perSecond <= 0) {
      throw new Error("Throttle requires a positive perSecond value");
    }

    if (options.name !== undefined || options.storageAdapter !== undefined) {
      this.stateTracker = new StateTracker({
        key: options.name ?? "throttle",
        default: Date.now(),
        stateDirectory: options.stateDirectory,
        storageAdapter: options.storageAdapter,
      });
    }

    this.nextAvailableAt = 0;
  }

  async wait(weight = 1): Promise<void> {
    if (!Number.isFinite(weight) || weight <= 0) {
      return;
    }

    if (this.stateTracker !== undefined && !this.stateLoaded) {
      await this.stateTracker.loadAsync();
      this.nextAvailableAt = this.stateTracker.state;
      this.stateLoaded = true;
    }

    const now = Date.now();
    const startAt = Math.max(now, this.nextAvailableAt);
    const processingWindowMs = duration({
      seconds: weight / this.perSecond,
    });
    const delayMs = startAt - now;
    const newNextAvailableAt = startAt + processingWindowMs;

    if (this.stateTracker !== undefined) {
      this.stateTracker.set(newNextAvailableAt);
      await this.stateTracker.saveAsync();
    }
    this.nextAvailableAt = newNextAvailableAt;

    if (delayMs > 0) {
      this.onDelay?.(delayMs, {
        weight,
        perSecond: this.perSecond,
        scheduledStart: startAt,
      });
      await sleep(delayMs);
    }
  }

  async run<T>(task: () => Promise<T> | T, weight = 1): Promise<T> {
    await this.wait(weight);
    return task();
  }
}

/**
 * Convenience factory for constructing a Throttle instance.
 */
export function throttle(options: ThrottleOptions): Throttle {
  return new Throttle(options);
}
