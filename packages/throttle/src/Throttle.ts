const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

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
    if (options.minimumDelayMs <= 0) {
      throw new Error('Throttle minimumDelayMs must be a positive number');
    }
    this.minimumDelayMs = options.minimumDelayMs;
    this.onSleep = options.onSleep;
  }

  /**
   * Wait until the minimum delay has elapsed since the last operation.
   *
   * Call this before each operation to ensure rate limiting.
   */
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
