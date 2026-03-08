import { type BackoffOptions, getBackoffDelay, sleep } from "./backoff.js";

export interface RetryOptions {
  /** Maximum number of attempts, including the first call (must be >= 1). */
  attempts: number;
  /**
   * Delay between retries.
   * - `true`: exponential backoff with package defaults
   * - `number`: fixed delay in milliseconds
   * - `BackoffOptions`: exponential backoff with custom settings
   */
  backoff?: boolean | number | BackoffOptions;
  /** Return false to stop retrying and throw immediately. */
  when?: (error: Error, attempt: number) => boolean | Promise<boolean>;
  /** Called before sleeping and retrying. */
  onRetry?: (
    error: Error,
    info: RetryInfo
  ) => void | Promise<void>;
}

export interface RetryInfo {
  /** 1-based attempt number that failed. */
  attempt: number;
  /** Total attempts configured for this retry loop. */
  attempts: number;
  /** Delay before the next attempt. */
  delayMs: number;
  /** Attempts remaining after this retry hook runs. */
  retriesLeft: number;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function getRetryDelayMs(
  backoff: RetryOptions["backoff"],
  attempt: number
): number {
  if (backoff === undefined || backoff === false) {
    return 0;
  }

  if (typeof backoff === "number") {
    return backoff;
  }

  return getBackoffDelay(attempt - 1, backoff === true ? {} : backoff);
}

/**
 * Retry an async function up to `attempts` times.
 * Returns the first successful result or throws the last error.
 */
export async function retry<T>(
  fn: () => Promise<T> | T,
  options: RetryOptions
): Promise<T> {
  if (!Number.isInteger(options.attempts) || options.attempts < 1) {
    throw new Error("retry requires attempts to be a positive integer");
  }

  let lastError!: Error;
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = normalizeError(error);
      if (attempt < options.attempts) {
        const shouldRetry = (await options.when?.(lastError, attempt)) ?? true;
        if (!shouldRetry) {
          break;
        }

        const delayMs = getRetryDelayMs(options.backoff, attempt);
        await options.onRetry?.(lastError, {
          attempt,
          attempts: options.attempts,
          delayMs,
          retriesLeft: options.attempts - attempt,
        });

        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }
  }
  throw lastError;
}
