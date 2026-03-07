import { collectPathDepthGroups, type PathDepthGroup } from "./pathDepth.js";

/**
 * Group path strings by their normalized `/`-separated depth, sorted deepest-first.
 * Useful when callers still want explicit depth metadata.
 */
export function groupByDepth(paths: readonly string[]): PathDepthGroup[] {
  return collectPathDepthGroups(paths);
}

export type { PathDepthGroup };
