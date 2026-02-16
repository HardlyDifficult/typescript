/**
 * Group path strings by their `/`-separated depth, sorted deepest-first.
 * Useful for bottom-up directory processing where children must be handled before parents.
 */
export function groupByDepth(
  paths: readonly string[]
): { depth: number; paths: string[] }[] {
  const depthMap = new Map<number, string[]>();

  for (const p of paths) {
    const depth = p === "" ? 0 : p.split("/").length;
    let group = depthMap.get(depth);
    if (!group) {
      group = [];
      depthMap.set(depth, group);
    }
    group.push(p);
  }

  return [...depthMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([depth, paths]) => ({ depth, paths }));
}
