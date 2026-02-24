/**
 * Git tree diffing utilities for determining which files need re-processing.
 * Compares current tree state against a stored manifest of previously processed SHAs.
 */

import type { TreeEntry } from "./types.js";

/** Manifest tracking which blob SHAs have been processed. */
export type FileManifest = Record<string, string>; // path -> blob SHA

/** Result of analyzing what needs to be re-processed. */
export interface TreeDiff {
  /** Files that are new or have changed content. */
  changedFiles: TreeEntry[];
  /** Files that were removed since last processing. */
  removedFiles: string[];
  /** Directories that need re-processing (contain changed/removed children). */
  staleDirs: string[];
}

/**
 * Diff the current git tree against the manifest to find what needs re-processing.
 */
export function diffTree(
  blobs: readonly TreeEntry[],
  manifest: FileManifest
): TreeDiff {
  const currentPaths = new Set(blobs.map((b) => b.path));
  const previousPaths = new Set(Object.keys(manifest));

  const changedFiles: TreeEntry[] = [];
  const removedFiles: string[] = [];
  const affectedDirs = new Set<string>();

  // Find changed and new files
  for (const blob of blobs) {
    const previousSha = manifest[blob.path];
    if (previousSha !== blob.sha) {
      changedFiles.push(blob);
      addAncestorDirs(blob.path, affectedDirs);
    }
  }

  // Find removed files
  for (const previousPath of previousPaths) {
    if (!currentPaths.has(previousPath)) {
      removedFiles.push(previousPath);
      addAncestorDirs(previousPath, affectedDirs);
    }
  }

  // Sort stale dirs deepest first (so leaves are processed before parents)
  const staleDirs = [...affectedDirs].sort((a, b) => {
    const depthA = a.split("/").length;
    const depthB = b.split("/").length;
    if (depthA !== depthB) {
      return depthB - depthA;
    }
    return a.localeCompare(b);
  });

  return { changedFiles, removedFiles, staleDirs };
}

/**
 * Collect all unique directory paths from a set of file paths.
 */
export function collectDirectories(filePaths: readonly string[]): string[] {
  const dirs = new Set<string>();
  for (const filePath of filePaths) {
    addAncestorDirs(filePath, dirs);
  }

  // Sort deepest first
  return [...dirs].sort((a, b) => {
    const depthA = a.split("/").length;
    const depthB = b.split("/").length;
    if (depthA !== depthB) {
      return depthB - depthA;
    }
    return a.localeCompare(b);
  });
}

/**
 * Group file paths by their immediate parent directory.
 */
export function groupByDirectory(
  filePaths: readonly string[]
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const filePath of filePaths) {
    const lastSlash = filePath.lastIndexOf("/");
    const dir = lastSlash === -1 ? "" : filePath.slice(0, lastSlash);
    const fileName =
      lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);

    let children = groups.get(dir);
    if (!children) {
      children = [];
      groups.set(dir, children);
    }
    children.push(fileName);
  }

  return groups;
}

/** A direct child entry discovered from a flat git tree. */
export interface TreeChild {
  /** The child's name (filename or directory name, no path separators). */
  name: string;
  /** The full path from the repository root. */
  fullPath: string;
  /** True if this child represents a directory. */
  isDir: boolean;
}

/**
 * Discover the direct children (files and directories) of a directory from a
 * flat git tree. Returns entries sorted: directories first, then files,
 * alphabetically within each group.
 *
 * Pass `dirPath = ''` to discover children of the repository root.
 */
export function discoverTreeChildren(
  tree: readonly TreeEntry[],
  dirPath: string
): readonly TreeChild[] {
  const prefix = dirPath === "" ? "" : `${dirPath}/`;
  const children: TreeChild[] = [];
  const seen = new Set<string>();

  for (const entry of tree) {
    if (entry.type !== "blob") {
      continue;
    }
    if (prefix !== "" && !entry.path.startsWith(prefix)) {
      continue;
    }

    const relative =
      prefix === "" ? entry.path : entry.path.slice(prefix.length);
    const slashIndex = relative.indexOf("/");
    const isDir = slashIndex !== -1;
    const childName = isDir ? relative.slice(0, slashIndex) : relative;

    if (!seen.has(childName)) {
      seen.add(childName);
      children.push({
        name: childName,
        fullPath: dirPath === "" ? childName : `${dirPath}/${childName}`,
        isDir,
      });
    }
  }

  children.sort((a, b) => {
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return children;
}

/**
 * Add all ancestor directories of a file path to the set.
 */
function addAncestorDirs(filePath: string, dirs: Set<string>): void {
  const parts = filePath.split("/");
  for (let i = 1; i < parts.length; i++) {
    dirs.add(parts.slice(0, i).join("/"));
  }
  // Root directory (empty string)
  dirs.add("");
}
