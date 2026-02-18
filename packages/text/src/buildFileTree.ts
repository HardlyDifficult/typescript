interface TreeNode {
  name: string;
  isDir: boolean;
  children?: TreeNode[];
  fullPath: string;
}

export interface BuildTreeOptions {
  maxLevel2?: number;
  maxLevel3?: number;
  annotations?: ReadonlyMap<string, string>;
  /** Extra indented lines to show under a file entry (e.g. key sections). Only applies to files, not directories. */
  details?: ReadonlyMap<string, readonly string[]>;
  /** Directory names to collapse. Matched dirs show a content summary instead of expanding children. */
  collapseDirs?: readonly string[];
}

/** Default truncation limits for file tree rendering. */
export const FILE_TREE_DEFAULTS: Required<
  Pick<BuildTreeOptions, "maxLevel2" | "maxLevel3">
> = {
  maxLevel2: 10,
  maxLevel3: 3,
};

/**
 * Count all descendant files and directories within a node.
 */
function countDescendants(node: TreeNode): { files: number; dirs: number } {
  let files = 0;
  let dirs = 0;
  for (const child of node.children ?? []) {
    if (child.isDir) {
      dirs++;
      const sub = countDescendants(child);
      files += sub.files;
      dirs += sub.dirs;
    } else {
      files++;
    }
  }
  return { files, dirs };
}

/**
 * Format a collapsed directory summary, e.g. "(42 files across 3 dirs)".
 */
function formatCollapsedSummary(files: number, dirs: number): string {
  const filePart = `${String(files)} ${files === 1 ? "file" : "files"}`;
  if (dirs === 0) {
    return `(${filePart})`;
  }
  const dirPart = `${String(dirs)} ${dirs === 1 ? "dir" : "dirs"}`;
  return `(${filePart} across ${dirPart})`;
}

/**
 * Builds a hierarchical file tree from flat paths with depth-based truncation.
 * Optionally annotates entries with short descriptions from the annotations map.
 */
export function buildFileTree(
  filePaths: readonly string[],
  options: BuildTreeOptions = {}
): string {
  const {
    maxLevel2 = FILE_TREE_DEFAULTS.maxLevel2,
    maxLevel3 = FILE_TREE_DEFAULTS.maxLevel3,
    annotations,
    details,
    collapseDirs,
  } = options;
  const collapseSet = collapseDirs ? new Set(collapseDirs) : undefined;

  // Build tree structure
  const root: TreeNode = { name: "", isDir: true, children: [], fullPath: "" };

  for (const filePath of filePaths) {
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      const currentFullPath = parts.slice(0, i + 1).join("/");

      current.children ??= [];

      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          isDir: !isLastPart,
          children: isLastPart ? undefined : [],
          fullPath: currentFullPath,
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Render tree with truncation
  const lines: string[] = [];

  function renderNode(node: TreeNode, depth: number, prefix: string) {
    if (!node.children || node.children.length === 0) {
      return;
    }

    // Sort: directories first, then alphabetically
    const sorted = [...node.children].sort((a, b) => {
      if (a.isDir !== b.isDir) {
        return a.isDir ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    // Determine limit based on depth
    let limit: number;
    if (depth === 1) {
      limit = Infinity;
    } else if (depth === 2) {
      limit = maxLevel2;
    } else {
      limit = maxLevel3;
    }
    const truncated = sorted.length > limit;
    const toShow = truncated ? sorted.slice(0, limit) : sorted;

    for (const child of toShow) {
      const marker = child.isDir ? "/" : "";
      const annotation = annotations?.get(child.fullPath) ?? "";
      const suffix = annotation !== "" ? ` — ${annotation}` : "";
      lines.push(`${prefix}${child.name}${marker}${suffix}`);

      // Render detail lines under files (e.g. key sections)
      if (!child.isDir && details?.has(child.fullPath) === true) {
        for (const detail of details.get(child.fullPath)!) {
          lines.push(`${prefix}  ${detail}`);
        }
      }

      if (child.isDir && collapseSet?.has(child.name) === true) {
        const { files, dirs } = countDescendants(child);
        if (files > 0 || dirs > 0) {
          lines.push(`${prefix}  ${formatCollapsedSummary(files, dirs)}`);
        }
      } else if (child.children && child.children.length > 0) {
        renderNode(child, depth + 1, `${prefix}  `);
      }
    }

    if (truncated) {
      const hiddenCount = sorted.length - limit;
      lines.push(`${prefix}.. (${String(hiddenCount)} more)`);
    }
  }

  renderNode(root, 1, "");
  return lines.join("\n");
}
