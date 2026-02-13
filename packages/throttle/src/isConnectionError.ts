/**
 * Connection error detection utilities
 */

/**
 * Check if an error is a connection error (e.g., ECONNREFUSED when Ollama is not running).
 * Walks the error chain (cause, errors, lastError) to find connection indicators.
 */
export function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Check the top-level message
  if (
    message.includes("econnrefused") ||
    message.includes("cannot connect to api")
  ) {
    return true;
  }

  // Check nested error properties from AI SDK RetryError / APICallError
  const err = error as unknown as Record<string, unknown>;

  if (err.lastError instanceof Error) {
    if (isConnectionError(err.lastError)) {
      return true;
    }
  }

  if (err.cause instanceof Error) {
    if (isConnectionError(err.cause)) {
      return true;
    }
  }

  if (Array.isArray(err.errors)) {
    for (const nested of err.errors) {
      if (isConnectionError(nested)) {
        return true;
      }
    }
  }

  // Check for Node.js error code
  if (err.code === "ECONNREFUSED") {
    return true;
  }

  return false;
}
