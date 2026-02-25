export type TrendLabel = "up" | "down" | "flat";

/** Classify a value as up/down/flat against a symmetric threshold. */
export function classifyTrend(
  value: number,
  threshold: number,
): TrendLabel {
  if (value > threshold) {
    return "up";
  }
  if (value < -threshold) {
    return "down";
  }
  return "flat";
}
