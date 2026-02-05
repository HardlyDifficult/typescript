import { StateTracker } from '@hardlydifficult/state';

/**
 * Information passed to the onSleep callback.
 */
export interface WeightedThrottleSleepInfo {
  /** The weight of the current operation */
  weight: number;
  /** The configured units per second limit */
  limitPerSecond: number;
  /** The timestamp when this operation is scheduled to start */
  scheduledStart: number;
}

/**
 * Options for configuring a WeightedThrottle instance.
 */
export interface WeightedThrottleOptions {
  /** Maximum units (e.g., requests, bytes) per second */
  unitsPerSecond: number;
  /** If provided, persist nextAvailableAt to disk for recovery across restarts */
  persistKey?: string;
  /** Directory to store state files (passed to StateTracker) */
  stateDirectory?: string;
  /** Callback invoked when the throttle needs to sleep */
  onSleep?: (delayMs: number, info: WeightedThrottleSleepInfo) => void;
}

/**
 * Ensures work does not exceed the configured rate when each operation
 * has a cost/weight (e.g., number of items, bytes, or API units).
 *
 * Optionally persists state to disk so that rate limiting survives restarts.
 */
export class WeightedThrottle {
  private nextAvailableAt: number;
  private readonly unitsPerSecond: number;
  private readonly stateTracker?: StateTracker;
  private readonly onSleep?: (delayMs: number, info: WeightedThrottleSleepInfo) => void;

  constructor(options: WeightedThrottleOptions) {
    this.unitsPerSecond = options.unitsPerSecond;
    this.onSleep = options.onSleep;

    if (!Number.isFinite(this.unitsPerSecond) || this.unitsPerSecond <= 0) {
      throw new Error('WeightedThrottle requires a positive unitsPerSecond value');
    }

    if (options.persistKey !== undefined) {
      this.stateTracker = new StateTracker<number>({
        key: options.persistKey,
        stateDirectory: options.stateDirectory,
      });
      // Load persisted state, defaulting to current time if none exists.
      // Using Date.now() as the default avoids creating artificial "debt"
      // if there's a long gap before first use.
      this.nextAvailableAt = this.stateTracker.load(Date.now());
    } else {
      this.nextAvailableAt = 0;
    }
  }

  /**
   * Wait until the rate limit allows processing an operation with the given weight.
   *
   * @param weight - The cost/weight of the operation (e.g., number of items)
   */
  async wait(weight: number): Promise<void> {
    if (!Number.isFinite(weight) || weight <= 0) {
      return;
    }

    const now = Date.now();
    const startAt = Math.max(now, this.nextAvailableAt);
    const processingWindowMs = (weight / this.unitsPerSecond) * 1000;
    const delayMs = startAt - now;
    const newNextAvailableAt = startAt + processingWindowMs;

    // Persist the intended nextAvailableAt before updating the in-memory value
    // so that, in case of a crash, the persisted state is at least as strict
    // as the last planned schedule.
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

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
