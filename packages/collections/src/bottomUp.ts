import { collectPathDepthGroups } from "./pathDepth.js";

/**
 * Group paths deepest-first for bottom-up processing.
 */
export function bottomUp(paths: readonly string[]): string[][] {
  return collectPathDepthGroups(paths).map(({ paths: pathsAtDepth }) => {
    return pathsAtDepth;
  });
}
