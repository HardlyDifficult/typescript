/**
 * Worker error formatting — maps error codes to user-friendly messages
 */

const WORKER_ERROR_MESSAGES: Record<string, string> = {
  MODEL_NOT_AVAILABLE:
    "No AI worker is available to handle this request. Please try again later.",
  TIMEOUT:
    "The request timed out. Please try a simpler question or try again later.",
  RATE_LIMITED: "Rate limited. Please wait a moment and try again.",
  WORKER_OVERLOADED: "Workers are busy. Please try again in a moment.",
  WORKER_DISCONNECTED:
    "The worker disconnected unexpectedly. Please try again.",
};

/**
 * Error codes that indicate a transient worker issue where a fallback
 * (e.g., a different AI provider) is worth attempting.
 */
export const RECOVERABLE_WORKER_ERRORS = [
  "MODEL_NOT_AVAILABLE",
  "WORKER_DISCONNECTED",
  "WORKER_OVERLOADED",
  "INTERNAL_ERROR",
] as const;

/**
 * Format a worker error code into a user-friendly message.
 *
 * @param errorCode - The error code from the worker result
 * @param fallbackMessage - Message to use if the error code is not recognized
 */
export function formatWorkerError(
  errorCode: string,
  fallbackMessage?: string
): string {
  return (
    WORKER_ERROR_MESSAGES[errorCode] ??
    fallbackMessage ??
    `Error: ${errorCode}`
  );
}
