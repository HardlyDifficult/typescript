export interface RetryOptions {
  /** Maximum number of attempts (must be >= 1) */
  maxAttempts: number;
  /** Called before each retry with the error and 1-based attempt number that failed */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Retry an async function up to `maxAttempts` times.
 * Returns the first successful result or throws the last error.
 *
 * No built-in delay — callers can `await sleep()` inside `onRetry` for backoff.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError!: Error;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < options.maxAttempts) {
        options.onRetry?.(lastError, attempt);
      }
    }
  }
  throw lastError;
}
