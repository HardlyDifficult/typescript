import { describe, it, expect } from "vitest";
import {
  formatBytes,
  getToolSummary,
} from "../src/tools/summaryFormatters.js";

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1024 * 1024 * 3.5)).toBe("3.5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1.2)).toBe("1.2 GB");
  });

  it("formats zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats exactly 1 KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

describe("getToolSummary", () => {
  it("returns generic summary for unknown tool", () => {
    expect(getToolSummary("unknown_tool", {}, "", "success")).toBe(
      "Tool: unknown_tool"
    );
  });

  it("returns failed summary for unknown tool on error", () => {
    expect(getToolSummary("unknown_tool", {}, "", "error")).toBe(
      "Tool: unknown_tool (failed)"
    );
  });

  describe("read_file", () => {
    it("formats starting phase with filename", () => {
      const result = getToolSummary(
        "read_file",
        { path: "/src/index.ts" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: read_file(index.ts)");
    });

    it("formats starting phase with batch", () => {
      const result = getToolSummary(
        "read_file",
        { path: ["/a.ts", "/b.ts", "/c.ts"] },
        "",
        "starting"
      );
      expect(result).toBe("Tool: read_file(3 files)");
    });

    it("formats success with parsed output", () => {
      const output = "[src/index.ts: 42 lines]\ncode here";
      const result = getToolSummary(
        "read_file",
        { path: "src/index.ts" },
        output,
        "success"
      );
      expect(result).toContain("read_file(src/index.ts)");
      expect(result).toContain("42 lines");
    });

    it("formats error phase", () => {
      const result = getToolSummary(
        "read_file",
        { path: "/src/index.ts" },
        "",
        "error",
        "File not found"
      );
      expect(result).toContain("File not found");
    });
  });

  describe("search_files", () => {
    it("formats starting phase with search params", () => {
      const result = getToolSummary(
        "search_files",
        { glob: "*.ts", regex: "import" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: search_files(glob=*.ts, regex=import)");
    });

    it("formats success with content search results", () => {
      const result = getToolSummary(
        "search_files",
        {},
        "Found 15 matches in 4 files\nresults...",
        "success"
      );
      expect(result).toBe("Tool: search_files - 15 matches in 4 files");
    });

    it("formats no matches output", () => {
      const result = getToolSummary(
        "search_files",
        {},
        "No matches found",
        "success"
      );
      expect(result).toBe("Tool: search_files - no matches");
    });
  });

  describe("write_file", () => {
    it("formats starting phase with edit count", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/index.ts", edits: [{}, {}] },
        "",
        "starting"
      );
      expect(result).toBe("Tool: write_file(index.ts) - 2 ops");
    });

    it("formats success with parsed output", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/index.ts" },
        "Updated src/index.ts (3 edits, now 120 lines)",
        "success"
      );
      expect(result).toContain("3 edits");
      expect(result).toContain("120 lines");
    });
  });

  describe("commit", () => {
    it("formats starting phase with title", () => {
      const result = getToolSummary(
        "commit",
        { title: "Fix bug" },
        "",
        "starting"
      );
      expect(result).toBe('Tool: commit("Fix bug")');
    });

    it("formats no changes output", () => {
      const result = getToolSummary(
        "commit",
        { title: "Fix bug" },
        "No changes to commit",
        "success"
      );
      expect(result).toBe("Tool: commit - no changes");
    });
  });

  describe("diff", () => {
    it("formats starting phase", () => {
      const result = getToolSummary(
        "diff",
        { against: "develop" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: diff(develop)");
    });

    it("formats starting phase with path", () => {
      const result = getToolSummary(
        "diff",
        { against: "main", path: "src/" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: diff(main src/)");
    });

    it("formats no differences", () => {
      const result = getToolSummary(
        "diff",
        { against: "main" },
        "No differences found",
        "success"
      );
      expect(result).toBe("Tool: diff(main) - no changes");
    });
  });
});
