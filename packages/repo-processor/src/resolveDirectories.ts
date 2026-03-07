import type { TreeEntry } from "@hardlydifficult/github";

import type { ResultsStore } from "./internalTypes.js";

export async function resolveStaleDirectories(
  staleDirsFromDiff: readonly string[],
  allFilePaths: readonly string[],
  tree: readonly TreeEntry[],
  store: ResultsStore
): Promise<string[]> {
  const treeShaByDir = new Map<string, string>();
  for (const entry of tree) {
    if (entry.type === "tree") {
      treeShaByDir.set(entry.path, entry.sha);
    }
  }

  const allExpectedDirs = new Set<string>();
  for (const filePath of allFilePaths) {
    const parts = filePath.split("/");
    for (let index = 1; index < parts.length; index++) {
      allExpectedDirs.add(parts.slice(0, index).join("/"));
    }
  }
  allExpectedDirs.add("");

  const needed = new Set(staleDirsFromDiff);
  for (const dirPath of allExpectedDirs) {
    if (needed.has(dirPath)) {
      continue;
    }

    const storedSha = await store.getDirSha(dirPath);
    if (storedSha === null) {
      needed.add(dirPath);
      continue;
    }

    const currentSha = treeShaByDir.get(dirPath) ?? "";
    if (storedSha !== currentSha) {
      needed.add(dirPath);
    }
  }

  return [...needed];
}
