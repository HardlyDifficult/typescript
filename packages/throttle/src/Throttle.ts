/**
 * Options for configuring a Throttle instance.
 */
export interface ThrottleOptions {
  /** Minimum delay between operations in milliseconds */
  minimumDelayMs: number;
  /** Optional callback invoked when throttle needs to sleep */
  onSleep?: (ms: number) => void;
}

/**
 * Simple throttle that enforces a minimum delay between operations.
 *
 * Useful for rate-limiting API calls or other operations that shouldn't
 * be executed too frequently.
 */
export class Throttle {
  private lastTimestamp = 0;
  private readonly minimumDelayMs: number;
  private readonly onSleep?: (ms: number) => void;

  constructor(options: ThrottleOptions) {
    this.minimumDelayMs = options.minimumDelayMs;
    this.onSleep = options.onSleep;
  }

  /**
   * Execute a task with throttling.
   *
   * If called too soon after the previous execution, this will delay
   * until the minimum delay has elapsed.
   *
   * @param task - The async task to execute
   * @returns The result of the task
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.delayIfNeeded();
    return task();
  }

  private async delayIfNeeded(): Promise<void> {
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

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
