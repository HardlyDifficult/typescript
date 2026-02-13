/**
 * Error utilities - consistent error handling across the codebase
 */

/**
 * Extract a message string from an unknown error
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Format an error for user-facing output
 */
export function formatError(err: unknown, context?: string): string {
  const message = getErrorMessage(err);
  return context ? `${context}: ${message}` : message;
}

/**
 * Format an error for logging (includes more detail for non-Error types)
 */
export function formatErrorForLog(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
