import type { TreeEntry } from "@hardlydifficult/github";

import type { ProcessorStore } from "./types.js";

/**
 * Find all directories that need (re-)processing.
 *
 * Combines two sources:
 * 1. Stale dirs from diffTree (directories with changed/removed children)
 * 2. Any directory whose stored SHA is missing or differs from the current tree SHA
 *
 * The second source handles recovery after partial failures and catches
 * directories whose tree SHA changed without any processable file changes.
 */
export async function resolveStaleDirectories(
  owner: string,
  repo: string,
  staleDirsFromDiff: readonly string[],
  allFilePaths: readonly string[],
  tree: readonly TreeEntry[],
  store: ProcessorStore
): Promise<string[]> {
  // Build map of directory path → current tree SHA
  const treeShaByDir = new Map<string, string>();
  for (const entry of tree) {
    if (entry.type === "tree") {
      treeShaByDir.set(entry.path, entry.sha);
    }
  }

  // Collect all directories that should be processed (derived from file paths + root)
  const allExpectedDirs = new Set<string>();
  for (const filePath of allFilePaths) {
    const parts = filePath.split("/");
    for (let i = 1; i < parts.length; i++) {
      allExpectedDirs.add(parts.slice(0, i).join("/"));
    }
  }
  // Always include root
  allExpectedDirs.add("");

  // Start with stale dirs from diff
  const needed = new Set(staleDirsFromDiff);

  // Check every expected directory for a missing or stale stored SHA
  for (const dirPath of allExpectedDirs) {
    if (needed.has(dirPath)) {
      continue;
    }

    const storedSha = await store.getDirSha(owner, repo, dirPath);
    if (storedSha === null) {
      needed.add(dirPath);
    } else {
      const currentSha = treeShaByDir.get(dirPath) ?? "";
      if (storedSha !== currentSha) {
        needed.add(dirPath);
      }
    }
  }

  return [...needed];
}
