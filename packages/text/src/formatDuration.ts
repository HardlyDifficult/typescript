/**
 * Format a duration in milliseconds as a short human-readable string.
 *
 * Shows at most two units (biggest first), skipping trailing zeros.
 *
 * @example
 * ```typescript
 * formatDuration(125_000)   // "2m 5s"
 * formatDuration(3_600_000) // "1h"
 * formatDuration(500)       // "<1s"
 * ```
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return "<1s";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  if (days > 0) {
    return hours > 0
      ? `${String(days)}d ${String(hours)}h`
      : `${String(days)}d`;
  }
  if (totalHours > 0) {
    return minutes > 0
      ? `${String(hours)}h ${String(minutes)}m`
      : `${String(hours)}h`;
  }
  if (totalMinutes > 0) {
    return seconds > 0
      ? `${String(minutes)}m ${String(seconds)}s`
      : `${String(minutes)}m`;
  }
  return `${String(seconds)}s`;
}
