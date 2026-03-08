/**
 * Converts a Unix timestamp in seconds to a Date.
 */
export function dateFromUnixSeconds(value: number | string): Date {
  const normalizedValue = typeof value === "number" ? value : value.trim();
  if (normalizedValue === "") {
    throw new Error("dateFromUnixSeconds(...) requires a numeric value");
  }

  const seconds =
    typeof normalizedValue === "number"
      ? normalizedValue
      : Number(normalizedValue);
  if (!Number.isFinite(seconds)) {
    throw new Error("dateFromUnixSeconds(...) requires a finite numeric value");
  }

  const date = new Date(seconds * 1_000);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Unix timestamp in seconds: ${String(value)}`);
  }

  return date;
}
