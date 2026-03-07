export interface PathDepthGroup {
  depth: number;
  paths: string[];
}

function getPathDepth(path: string): number {
  if (path === "") {
    return 0;
  }

  return path.split("/").filter((segment) => segment.length > 0).length;
}

/** Group paths by depth, sorted from deepest to shallowest. */
export function collectPathDepthGroups(
  paths: readonly string[]
): PathDepthGroup[] {
  const depthMap = new Map<number, string[]>();

  for (const path of paths) {
    const depth = getPathDepth(path);
    const group = depthMap.get(depth);
    if (group) {
      group.push(path);
      continue;
    }

    depthMap.set(depth, [path]);
  }

  return [...depthMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([depth, pathsAtDepth]) => ({ depth, paths: pathsAtDepth }));
}
