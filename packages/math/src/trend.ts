export type TrendLabel = "up" | "down" | "flat";

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
