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
  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
    timeZone,
  }).format(new Date(timestampMs));

  // Some ICU/runtime combinations can still render midnight as 24:xx:xx.
  // Normalize to 00:xx:xx for a stable 24-hour clock.
  if (formatted.startsWith("24:")) {
    return `00:${formatted.slice(3)}`;
  }

  return formatted;
}
