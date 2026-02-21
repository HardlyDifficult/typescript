/**
 * Normalize a value that may be a single item or an array into an array.
 * Used by batchable tools to accept both `string` and `string[]` inputs.
 */
export function toArray<T>(input: T | T[]): T[] {
  return Array.isArray(input) ? input : [input];
}

/**
 * Wraps tool execution in try-catch and returns error message string.
 * Eliminates duplicate try-catch blocks across tools.
 */
export async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  errorPrefix: string
): Promise<T | string> {
  try {
    return await operation();
  } catch (error) {
    return `${errorPrefix}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Formats array results with empty handling.
 * Returns a custom message if the array is empty, otherwise joins with newlines.
 */
export function formatArrayResult(
  items: string[],
  emptyMessage: string
): string {
  if (items.length === 0) {
    return emptyMessage;
  }
  return items.join("\n");
}
