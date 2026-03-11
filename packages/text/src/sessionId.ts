/**
 * Creates a unique session ID with the given prefix, a base-36 timestamp, and a random suffix.
 */
export function createSessionId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
