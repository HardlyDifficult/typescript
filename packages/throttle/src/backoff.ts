/**
 * Exponential backoff utilities for retry logic
 */

export interface BackoffOptions {
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 60000) */
  maxDelayMs?: number;
}

const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 60000;

/**
 * Calculate exponential backoff delay for a given attempt number
 * Uses formula: min(initialDelay * 2^attempt, maxDelay)
 *
 * @param attempt - The attempt number (0-indexed)
 * @param options - Configuration options
 * @returns Delay in milliseconds
 */
export function getBackoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const initialDelay = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelay = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const delay = initialDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get a randomized delay for retry logic
 * Returns a delay between minMs and maxMs (inclusive)
 */
export function getRandomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}
