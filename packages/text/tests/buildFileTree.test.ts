import { describe, it, expect } from "vitest";
import { buildFileTree, FILE_TREE_DEFAULTS } from "../src/buildFileTree.js";

describe("buildFileTree", () => {
  it("renders a simple file tree", () => {
    const result = buildFileTree(["src/index.ts", "src/utils.ts", "README.md"]);
    expect(result).toBe(
      ["src/", "  index.ts", "  utils.ts", "", "README.md"].join("\n")
    );
  });

  it("sorts directories before files", () => {
    const result = buildFileTree(["file.ts", "dir/child.ts"]);
    expect(result).toBe(["dir/", "  child.ts", "", "file.ts"].join("\n"));
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

  describe("details", () => {
    it("renders detail lines under a file", () => {
      const details = new Map([
        [
          "src/index.ts",
          [
            "> main (5-20): App entry point.",
            "> shutdown (22-35): Cleanup handler.",
          ],
        ],
      ]);
      const result = buildFileTree(["src/index.ts", "src/utils.ts"], {
        details,
      });
      expect(result).toBe(
        [
          "src/",
          "  index.ts",
          "    > main (5-20): App entry point.",
          "    > shutdown (22-35): Cleanup handler.",
          "  utils.ts",
        ].join("\n")
      );
    });

    it("does not render details for directories", () => {
      const details = new Map([["src", ["should not appear"]]]);
      const result = buildFileTree(["src/index.ts"], { details });
      expect(result).toBe(["src/", "  index.ts"].join("\n"));
    });

    it("combines with annotations", () => {
      const annotations = new Map([["index.ts", "Main entry point"]]);
      const details = new Map([
        ["index.ts", ["> main (1-10): Starts the app."]],
      ]);
      const result = buildFileTree(["index.ts"], { annotations, details });
      expect(result).toBe(
        [
          "index.ts — Main entry point",
          "  > main (1-10): Starts the app.",
        ].join("\n")
      );
    });

    it("skips files without details", () => {
      const details = new Map([
        ["src/index.ts", ["> main (5-20): Entry point."]],
      ]);
      const result = buildFileTree(["src/index.ts", "src/utils.ts"], {
        details,
      });
      expect(result).toContain("    > main (5-20): Entry point.");
      expect(result).not.toContain("utils.ts\n    >");
    });

    it("renders empty array as no details", () => {
      const details = new Map([["index.ts", []]]);
      const result = buildFileTree(["index.ts"], { details });
      expect(result).toBe("index.ts");
    });
  });

  describe("collapseDirs", () => {
    it("collapses matching directory with summary", () => {
      const result = buildFileTree(
        [
          "src/index.ts",
          "test/unit/a.test.ts",
          "test/unit/b.test.ts",
          "test/e2e/c.test.ts",
        ],
        { collapseDirs: ["test"] }
      );
      expect(result).toBe(
        ["src/", "  index.ts", "", "test/", "  (3 files across 2 dirs)"].join("\n")
      );
    });

    it("collapses directory with files only (no subdirs)", () => {
      const result = buildFileTree(["test/a.ts", "test/b.ts", "src/index.ts"], {
        collapseDirs: ["test"],
      });
      expect(result).toBe(
        ["src/", "  index.ts", "", "test/", "  (2 files)"].join("\n")
      );
    });

    it("collapses at nested depth", () => {
      const result = buildFileTree(
        [
          "packages/bot/src/index.ts",
          "packages/bot/test/a.test.ts",
          "packages/bot/test/b.test.ts",
        ],
        { collapseDirs: ["test"] }
      );
      expect(result).toContain("test/");
      expect(result).toContain("(2 files)");
      expect(result).not.toContain("a.test.ts");
    });

    it("does not collapse directories not in the list", () => {
      const result = buildFileTree(
        ["src/index.ts", "src/utils.ts", "test/a.test.ts"],
        { collapseDirs: ["test"] }
      );
      expect(result).toContain("  index.ts");
      expect(result).toContain("  utils.ts");
    });

    it("uses singular for count of 1", () => {
      const result = buildFileTree(["test/sub/only.ts"], {
        collapseDirs: ["test"],
      });
      expect(result).toContain("(1 file across 1 dir)");
    });

    it("preserves annotations on collapsed directories", () => {
      const annotations = new Map([["test", "Unit tests"]]);
      const result = buildFileTree(["test/a.test.ts", "test/b.test.ts"], {
        collapseDirs: ["test"],
        annotations,
      });
      expect(result).toContain("test/ \u2014 Unit tests");
      expect(result).toContain("(2 files)");
      expect(result).not.toContain("a.test.ts");
    });

    it("shows nothing extra for empty collapsed directory", () => {
      const result = buildFileTree(["src/index.ts"], {
        collapseDirs: ["test"],
      });
      expect(result).toBe("src/\n  index.ts");
    });

    it("works without collapseDirs (default behavior)", () => {
      const result = buildFileTree(["test/a.ts", "test/b.ts"]);
      expect(result).toBe(["test/", "  a.ts", "  b.ts"].join("\n"));
    });
  });
});
