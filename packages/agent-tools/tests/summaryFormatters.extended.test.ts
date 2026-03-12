import { describe, it, expect } from "vitest";
import { getToolSummary } from "../src/tools/summaryFormatters.js";

describe("getToolSummary - extended coverage", () => {
  // ── explore / list_directory ─────────────────────────────────────────────

  describe("explore", () => {
    it("formats starting phase with single path", () => {
      const result = getToolSummary(
        "explore",
        { path: "/src" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: explore(/src)");
    });

    it("formats starting phase with batch paths", () => {
      const result = getToolSummary(
        "explore",
        { path: ["/a", "/b"] },
        "",
        "starting"
      );
      expect(result).toBe("Tool: explore(2 dirs)");
    });

    it("formats starting phase with no path (defaults to .)", () => {
      const result = getToolSummary("explore", {}, "", "starting");
      expect(result).toBe("Tool: explore(.)");
    });

    it("formats error phase", () => {
      const result = getToolSummary(
        "explore",
        { path: "/src" },
        "",
        "error",
        "Permission denied"
      );
      expect(result).toBe("Tool: explore(/src) - Permission denied");
    });

    it("formats error phase with no message", () => {
      const result = getToolSummary("explore", { path: "/src" }, "", "error");
      expect(result).toBe("Tool: explore(/src) - error");
    });

    it("formats success with empty/non-existent directory", () => {
      const result = getToolSummary(
        "explore",
        { path: "/empty" },
        "Directory is empty or does not exist",
        "success"
      );
      expect(result).toBe("Tool: explore(/empty) - empty");
    });

    it("formats success with file count from parsed output", () => {
      const result = getToolSummary(
        "explore",
        { path: "/src" },
        "src/\n  index.ts\n  utils.ts\n[5 files]",
        "success"
      );
      expect(result).toBe("Tool: explore(/src) - 5 files");
    });

    it("formats success when parse returns 0 files", () => {
      // output with no [N files] tag and no non-empty lines
      const result = getToolSummary("explore", { path: "/src" }, "", "success");
      expect(result).toBe("Tool: explore(/src)");
    });
  });

  describe("list_directory", () => {
    it("uses the same formatter as explore (tool name in output is 'explore')", () => {
      // The formatter for list_directory reuses formatExploreSummary which
      // hard-codes "explore" in the output string, ignoring the toolName arg.
      const result = getToolSummary(
        "list_directory",
        { path: "/src" },
        "[3 files]",
        "success"
      );
      expect(result).toBe("Tool: explore(/src) - 3 files");
    });
  });

  // ── search_files – additional branches ──────────────────────────────────

  describe("search_files - additional branches", () => {
    it("formats error phase with message", () => {
      const result = getToolSummary(
        "search_files",
        {},
        "",
        "error",
        "Search timed out"
      );
      expect(result).toBe("Tool: search_files - Search timed out");
    });

    it("formats error phase with no message", () => {
      const result = getToolSummary("search_files", {}, "", "error");
      expect(result).toBe("Tool: search_files - error");
    });

    it("formats starting phase with name param", () => {
      const result = getToolSummary(
        "search_files",
        { name: "README.md" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: search_files(name=README.md)");
    });

    it("formats starting phase with no params", () => {
      const result = getToolSummary("search_files", {}, "", "starting");
      expect(result).toBe("Tool: search_files()");
    });

    it("formats success with file count (glob search)", () => {
      const result = getToolSummary(
        "search_files",
        {},
        "Found 7 files:\nfoo.ts\nbar.ts",
        "success"
      );
      expect(result).toBe("Tool: search_files - 7 files");
    });

    it('formats success with "No files found"', () => {
      const result = getToolSummary(
        "search_files",
        {},
        "No files found",
        "success"
      );
      expect(result).toBe("Tool: search_files - no matches");
    });

    it("formats success with unrecognised output", () => {
      const result = getToolSummary(
        "search_files",
        {},
        "something else",
        "success"
      );
      expect(result).toBe("Tool: search_files");
    });
  });

  // ── read_file – additional branches ─────────────────────────────────────

  describe("read_file - additional branches", () => {
    it("formats success with batch file count", () => {
      // "[3 files read]" footer triggers fileCount path
      const result = getToolSummary(
        "read_file",
        { path: ["/a.ts", "/b.ts", "/c.ts"] },
        "content\n[3 files read]",
        "success"
      );
      expect(result).toContain("3 files read");
    });

    it("formats success with no parsed output", () => {
      const result = getToolSummary(
        "read_file",
        { path: "/unknown" },
        "raw output without markers",
        "success"
      );
      expect(result).toBe("Tool: read_file(unknown)");
    });

    it("formats error phase with no message", () => {
      const result = getToolSummary(
        "read_file",
        { path: "/src/index.ts" },
        "",
        "error"
      );
      expect(result).toBe("Tool: read_file(index.ts) - error");
    });

    it("formats starting phase with non-string path", () => {
      const result = getToolSummary("read_file", { path: 42 }, "", "starting");
      expect(result).toBe("Tool: read_file(unknown)");
    });
  });

  // ── write_file – additional branches ────────────────────────────────────

  describe("write_file - additional branches", () => {
    it("formats starting phase with single edit (non-array)", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/index.ts", edits: { old: "a", new: "b" } },
        "",
        "starting"
      );
      expect(result).toBe("Tool: write_file(index.ts) - 1 op");
    });

    it("formats starting phase with no edits", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/index.ts" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: write_file(index.ts)");
    });

    it("formats error phase", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/index.ts" },
        "",
        "error",
        "Disk full"
      );
      expect(result).toBe("Tool: write_file(index.ts) - Disk full");
    });

    it("formats error phase with no message", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/index.ts" },
        "",
        "error"
      );
      expect(result).toBe("Tool: write_file(index.ts) - error");
    });

    it("formats success with Wrote ... (N lines) pattern", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/foo.ts" },
        "Wrote /src/foo.ts (42 lines)",
        "success"
      );
      expect(result).toContain("42 lines");
    });

    it("formats success with Wrote ... (N chars) pattern", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/foo.ts" },
        "Wrote /src/foo.ts (1024 chars)",
        "success"
      );
      expect(result).toContain("1.0 KB");
    });

    it("formats success with Updated ... lines range pattern", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/foo.ts" },
        "Updated /src/foo.ts lines 10-20",
        "success"
      );
      expect(result).toContain("lines 10-20");
    });

    it("formats success with non-matching output", () => {
      const result = getToolSummary(
        "write_file",
        { path: "/src/foo.ts" },
        "some unrecognised output",
        "success"
      );
      expect(result).toBe("Tool: write_file(foo.ts)");
    });

    it("formats success with non-string path", () => {
      const result = getToolSummary(
        "write_file",
        {},
        "some unrecognised output",
        "success"
      );
      expect(result).toBe("Tool: write_file(unknown)");
    });
  });

  // ── diff ─────────────────────────────────────────────────────────────────

  describe("diff", () => {
    it("formats error phase with message", () => {
      const result = getToolSummary(
        "diff",
        { against: "main" },
        "",
        "error",
        "Not a git repo"
      );
      expect(result).toBe("Tool: diff(main) - Not a git repo");
    });

    it("formats error phase with no message", () => {
      const result = getToolSummary("diff", { against: "main" }, "", "error");
      expect(result).toBe("Tool: diff(main) - error");
    });

    it("uses default against=main when not specified", () => {
      const result = getToolSummary("diff", {}, "", "starting");
      expect(result).toBe("Tool: diff(main)");
    });

    it("formats success with changed files stat", () => {
      const result = getToolSummary(
        "diff",
        { against: "main" },
        "diff --stat\n3 files changed, 10 insertions, 2 deletions",
        "success"
      );
      expect(result).toBe("Tool: diff(main) - 3 files changed");
    });

    it("formats success with singular file stat", () => {
      const result = getToolSummary(
        "diff",
        { against: "main" },
        "1 file changed, 5 insertions",
        "success"
      );
      expect(result).toBe("Tool: diff(main) - 1 file changed");
    });

    it("formats success with unrecognised output", () => {
      const result = getToolSummary(
        "diff",
        { against: "main" },
        "some diff output",
        "success"
      );
      expect(result).toBe("Tool: diff(main)");
    });
  });

  // ── revert ───────────────────────────────────────────────────────────────

  describe("revert", () => {
    it("formats starting phase", () => {
      const result = getToolSummary(
        "revert",
        { to: "abc123", path: "/src" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: revert(/src → abc123)");
    });

    it("formats success phase", () => {
      const result = getToolSummary(
        "revert",
        { to: "HEAD", path: "/src" },
        "Reverted successfully",
        "success"
      );
      expect(result).toBe("Tool: revert(/src → HEAD)");
    });

    it("formats error phase with message", () => {
      const result = getToolSummary(
        "revert",
        { to: "HEAD", path: "/src" },
        "",
        "error",
        "Nothing to revert"
      );
      expect(result).toBe("Tool: revert(/src → HEAD) - Nothing to revert");
    });

    it("formats error phase with no message", () => {
      const result = getToolSummary(
        "revert",
        { to: "HEAD", path: "/src" },
        "",
        "error"
      );
      expect(result).toBe("Tool: revert(/src → HEAD) - error");
    });

    it("uses defaults when to/path are missing", () => {
      const result = getToolSummary("revert", {}, "", "starting");
      expect(result).toBe("Tool: revert(repo → last_commit)");
    });
  });

  // ── commit – additional branches ─────────────────────────────────────────

  describe("commit - additional branches", () => {
    it("formats error phase with message", () => {
      const result = getToolSummary(
        "commit",
        { title: "Fix bug" },
        "",
        "error",
        "Pre-commit hook failed"
      );
      expect(result).toBe("Tool: commit - Pre-commit hook failed");
    });

    it("formats error phase with no message", () => {
      const result = getToolSummary(
        "commit",
        { title: "Fix bug" },
        "",
        "error"
      );
      expect(result).toBe("Tool: commit - error");
    });

    it("formats success with Commit aborted output", () => {
      const result = getToolSummary(
        "commit",
        { title: "Fix bug" },
        "Commit aborted: lint errors",
        "success"
      );
      expect(result).toBe('Tool: commit("Fix bug") - verification failed');
    });

    it("formats success with files summary line", () => {
      const result = getToolSummary(
        "commit",
        { title: "Add feature" },
        "hash abc123\n5 files: src/a.ts src/b.ts",
        "success"
      );
      expect(result).toBe('Tool: commit("Add feature") - 5 files');
    });

    it("formats success with single file summary line", () => {
      const result = getToolSummary(
        "commit",
        { title: "Add feature" },
        "1 file: src/a.ts",
        "success"
      );
      expect(result).toBe('Tool: commit("Add feature") - 1 files');
    });

    it("formats success with unrecognised output", () => {
      const result = getToolSummary(
        "commit",
        { title: "Add feature" },
        "Committed",
        "success"
      );
      expect(result).toBe('Tool: commit("Add feature")');
    });

    it("uses empty string when title is not a string", () => {
      const result = getToolSummary("commit", {}, "", "starting");
      expect(result).toBe('Tool: commit("")');
    });
  });

  // ── agent-browser ────────────────────────────────────────────────────────

  describe("agent-browser", () => {
    it("formats starting phase with action and target", () => {
      const result = getToolSummary(
        "agent-browser",
        { command: "navigate https://example.com" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: agent-browser navigate https://example.com");
    });

    it("formats starting phase with action only (no target)", () => {
      const result = getToolSummary(
        "agent-browser",
        { command: "screenshot" },
        "",
        "starting"
      );
      expect(result).toBe("Tool: agent-browser screenshot");
    });

    it("formats starting phase with empty command", () => {
      const result = getToolSummary("agent-browser", {}, "", "starting");
      // action="" with no target
      expect(result).toBe("Tool: agent-browser ");
    });

    it("formats error phase with message", () => {
      const result = getToolSummary(
        "agent-browser",
        { command: "navigate https://example.com" },
        "",
        "error",
        "Connection refused"
      );
      expect(result).toBe("Tool: agent-browser - Connection refused");
    });

    it("formats error phase with no message", () => {
      const result = getToolSummary(
        "agent-browser",
        { command: "navigate https://example.com" },
        "",
        "error"
      );
      expect(result).toBe("Tool: agent-browser - error");
    });

    it("formats success phase with short output", () => {
      const result = getToolSummary(
        "agent-browser",
        { command: "navigate https://example.com" },
        "Page loaded successfully",
        "success"
      );
      expect(result).toBe(
        "Tool: agent-browser navigate - Page loaded successfully"
      );
    });

    it("formats success phase with long output (truncated)", () => {
      const longOutput = "A".repeat(100);
      const result = getToolSummary(
        "agent-browser",
        { command: "screenshot" },
        longOutput,
        "success"
      );
      expect(result).toContain("...");
      expect(result.length).toBeLessThan(longOutput.length + 50);
    });

    it("formats success phase with newlines in output", () => {
      const result = getToolSummary(
        "agent-browser",
        { command: "navigate https://example.com" },
        "line1\nline2\nline3",
        "success"
      );
      expect(result).not.toContain("\n");
    });
  });
});
