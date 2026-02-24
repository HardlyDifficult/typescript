import { describe, it, expect } from "vitest";
import { discoverTreeChildren } from "../src/treeDiff.js";
import type { TreeEntry } from "../src/types.js";

const blob = (path: string): TreeEntry => ({ path, type: "blob", sha: "abc", size: 100 });
const treeEntry = (path: string): TreeEntry => ({ path, type: "tree", sha: "def" });

describe("discoverTreeChildren", () => {
  it("discovers direct file children of a directory", () => {
    const tree = [
      blob("src/index.ts"),
      blob("src/utils.ts"),
      blob("README.md"),
    ];

    const result = discoverTreeChildren(tree, "src");
    expect(result).toEqual([
      { name: "index.ts", fullPath: "src/index.ts", isDir: false },
      { name: "utils.ts", fullPath: "src/utils.ts", isDir: false },
    ]);
  });

  it("discovers direct directory children", () => {
    const tree = [
      blob("src/services/foo.ts"),
      blob("src/utils/bar.ts"),
      blob("src/index.ts"),
    ];

    const result = discoverTreeChildren(tree, "src");
    expect(result).toEqual([
      { name: "services", fullPath: "src/services", isDir: true },
      { name: "utils", fullPath: "src/utils", isDir: true },
      { name: "index.ts", fullPath: "src/index.ts", isDir: false },
    ]);
  });

  it("sorts directories before files, alphabetically within each group", () => {
    const tree = [
      blob("src/z-file.ts"),
      blob("src/b-dir/nested.ts"),
      blob("src/a-file.ts"),
      blob("src/a-dir/nested.ts"),
    ];

    const result = discoverTreeChildren(tree, "src");
    expect(result.map((c) => c.name)).toEqual([
      "a-dir",
      "b-dir",
      "a-file.ts",
      "z-file.ts",
    ]);
  });

  it("discovers children of the repository root (dirPath='')", () => {
    const tree = [
      blob("packages/text/src/index.ts"),
      blob("README.md"),
      blob("tsconfig.json"),
    ];

    const result = discoverTreeChildren(tree, "");
    expect(result).toEqual([
      { name: "packages", fullPath: "packages", isDir: true },
      { name: "README.md", fullPath: "README.md", isDir: false },
      { name: "tsconfig.json", fullPath: "tsconfig.json", isDir: false },
    ]);
  });

  it("deduplicates directory children that appear multiple times", () => {
    const tree = [
      blob("src/utils/a.ts"),
      blob("src/utils/b.ts"),
      blob("src/utils/c.ts"),
    ];

    const result = discoverTreeChildren(tree, "src");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "utils", fullPath: "src/utils", isDir: true });
  });

  it("returns empty array when directory has no children", () => {
    const tree = [blob("other/file.ts")];
    const result = discoverTreeChildren(tree, "src");
    expect(result).toEqual([]);
  });

  it("ignores tree-type entries (only considers blobs)", () => {
    const tree = [
      treeEntry("src"),
      treeEntry("src/utils"),
      blob("src/index.ts"),
    ];

    const result = discoverTreeChildren(tree, "src");
    expect(result).toEqual([
      { name: "index.ts", fullPath: "src/index.ts", isDir: false },
    ]);
  });

  it("does not include children of deeper nested paths in root discovery", () => {
    const tree = [
      blob("a/b/c.ts"),
      blob("a/d.ts"),
    ];

    const result = discoverTreeChildren(tree, "a");
    expect(result).toEqual([
      { name: "b", fullPath: "a/b", isDir: true },
      { name: "d.ts", fullPath: "a/d.ts", isDir: false },
    ]);
  });
});
