const DEFAULT_TIME_ZONE = "America/New_York";

/**
 * Formats a timestamp (ms since epoch) as an HH:mm:ss clock string.
 *
 * Defaults to Eastern time via America/New_York.
 */
export function formatClockTime(
  timestampMs: number,
  timeZone = DEFAULT_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(timestampMs));
}
