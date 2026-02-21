/**
 * Transient network error detection for retry logic.
 *
 * Detects temporary network failures (connection resets, timeouts, DNS)
 * that are safe to retry. Distinct from {@link isConnectionError} which
 * detects "service unreachable" errors like ECONNREFUSED.
 */
export function isTransientNetworkError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("recv failure") ||
    lower.includes("connection was reset") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("unable to access") ||
    lower.includes("could not resolve host") ||
    lower.includes("tls connection was non-properly terminated") ||
    lower.includes("the remote end hung up unexpectedly")
  );
}
