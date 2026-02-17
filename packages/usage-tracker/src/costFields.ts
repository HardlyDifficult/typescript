import type { DeepPartial, NumericRecord } from "./types.js";

const COST_SUFFIX = "costusd";

/**
 * Walk a NumericRecord and return dot-separated paths for every
 * leaf key whose name ends with "CostUsd" (case-insensitive).
 *
 * Matches: `costUsd`, `estimatedCostUsd`, `totalCostUsd`, etc.
 *
 * Example:
 *   { anthropic: { estimatedCostUsd: 0, tokens: 0 }, claudeCode: { totalCostUsd: 0 } }
 *   → ["anthropic.estimatedCostUsd", "claudeCode.totalCostUsd"]
 */
export function findCostFieldPaths(obj: NumericRecord, prefix = ""): string[] {
  const paths: string[] = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const fullPath = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "number") {
      if (key.toLowerCase().endsWith(COST_SUFFIX)) {
        paths.push(fullPath);
      }
    } else {
      paths.push(...findCostFieldPaths(value, fullPath));
    }
  }
  return paths;
}

/**
 * Extract the total cost from a partial delta by summing the values at
 * the given dot-separated cost paths.
 *
 * Safely traverses — missing intermediate keys return 0.
 */
export function extractCostFromDelta(
  delta: DeepPartial<NumericRecord>,
  costPaths: string[]
): number {
  let total = 0;
  for (const path of costPaths) {
    const segments = path.split(".");
    let current: unknown = delta;
    for (const segment of segments) {
      if (
        current === undefined ||
        current === null ||
        typeof current !== "object"
      ) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current === "number") {
      total += current;
    }
  }
  return total;
}
