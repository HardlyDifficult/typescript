import { describe, it, expect } from "vitest";
import { buildFileTree, FILE_TREE_DEFAULTS } from "../src/buildFileTree.js";

describe("buildFileTree", () => {
  it("renders a simple file tree", () => {
    const result = buildFileTree(["src/index.ts", "src/utils.ts", "README.md"]);
    expect(result).toBe(
      ["src/", "  index.ts", "  utils.ts", "README.md"].join("\n")
    );
  });

  it("sorts directories before files", () => {
    const result = buildFileTree(["file.ts", "dir/child.ts"]);
    expect(result).toBe(["dir/", "  child.ts", "file.ts"].join("\n"));
  });

  it("truncates level 2 children", () => {
    const paths = Array.from({ length: 15 }, (_, i) => `src/file${i}.ts`);
    const result = buildFileTree(paths, { maxLevel2: 3 });
    const lines = result.split("\n");
    expect(lines).toContain("  .. (12 more)");
  });

  it("returns empty string for no paths", () => {
    expect(buildFileTree([])).toBe("");
  });

  it("has correct defaults", () => {
    expect(FILE_TREE_DEFAULTS.maxLevel2).toBe(10);
    expect(FILE_TREE_DEFAULTS.maxLevel3).toBe(3);
  });

  describe("annotations", () => {
    it("appends annotation to file entry", () => {
      const annotations = new Map([["src/index.ts", "Main entry point"]]);
      const result = buildFileTree(["src/index.ts"], { annotations });
      expect(result).toContain("index.ts \u2014 Main entry point");
    });

    it("appends annotation to directory entry", () => {
      const annotations = new Map([["src", "Source code directory"]]);
      const result = buildFileTree(["src/index.ts"], { annotations });
      expect(result).toContain("src/ \u2014 Source code directory");
    });

    it("leaves unannotated entries unchanged", () => {
      const annotations = new Map([["src/index.ts", "Main entry point"]]);
      const result = buildFileTree(["src/index.ts", "src/utils.ts"], {
        annotations,
      });
      expect(result).toContain("index.ts \u2014 Main entry point");
      expect(result).toContain("  utils.ts");
      expect(result).not.toContain("utils.ts \u2014");
    });

    it("works with nested paths", () => {
      const annotations = new Map([
        ["packages/bot", "Discord bot service"],
        ["packages/bot/src/index.ts", "Bot entry point"],
      ]);
      const result = buildFileTree(["packages/bot/src/index.ts"], {
        annotations,
      });
      expect(result).toContain("bot/ \u2014 Discord bot service");
      expect(result).toContain("index.ts \u2014 Bot entry point");
    });
  });
});
