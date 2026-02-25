import { describe, expect, it } from "vitest";

import { sanitizeToolInput, truncateString } from "../src/sanitize.js";

describe("truncateString", () => {
  it("returns the string unchanged when within limit", () => {
    expect(truncateString("hello", 10)).toBe("hello");
  });

  it("returns the string unchanged when exactly at limit", () => {
    expect(truncateString("hello", 5)).toBe("hello");
  });

  it("truncates and appends indicator when over limit", () => {
    expect(truncateString("hello world", 5)).toBe("hello... (truncated)");
  });

  it("handles empty string", () => {
    expect(truncateString("", 5)).toBe("");
  });
});

describe("sanitizeToolInput", () => {
  describe("read tools", () => {
    const readTools = [
      "Read",
      "read_source_file",
      "read_file",
      "explore",
      "list_directory",
      "Glob",
      "Grep",
    ];

    for (const toolName of readTools) {
      it(`keeps only path fields for ${toolName}`, () => {
        const result = sanitizeToolInput(toolName, {
          file_path: "/src/index.ts",
          content: "very long file content that should be removed",
          limit: 100,
        });
        expect(result).toHaveProperty("file_path", "/src/index.ts");
        expect(result).not.toHaveProperty("content");
        expect(result).toHaveProperty("limit", 100);
      });
    }

    it("keeps short string non-path fields", () => {
      const result = sanitizeToolInput("Read", {
        file_path: "/src/index.ts",
        mode: "utf-8",
      });
      expect(result).toHaveProperty("mode", "utf-8");
    });

    it("drops long string non-path fields", () => {
      const result = sanitizeToolInput("Read", {
        file_path: "/src/index.ts",
        description: "x".repeat(201),
      });
      expect(result).not.toHaveProperty("description");
    });
  });

  describe("write/edit tools", () => {
    const writeTools = ["Write", "write_file", "Edit", "edit_file"];

    for (const toolName of writeTools) {
      it(`truncates content field for ${toolName}`, () => {
        const longContent = "x".repeat(600);
        const result = sanitizeToolInput(toolName, {
          file_path: "/src/index.ts",
          content: longContent,
        });
        expect(result.content).toBe(`${"x".repeat(500)}... (truncated)`);
      });
    }

    it("truncates newText and oldText for Edit", () => {
      const longText = "y".repeat(600);
      const result = sanitizeToolInput("Edit", {
        file_path: "/src/index.ts",
        newText: longText,
        oldText: longText,
      });
      expect(result.newText).toBe(`${"y".repeat(500)}... (truncated)`);
      expect(result.oldText).toBe(`${"y".repeat(500)}... (truncated)`);
    });

    it("truncates content within array edits", () => {
      const longContent = "z".repeat(600);
      const result = sanitizeToolInput("Write", {
        edits: [{ file_path: "/a.ts", content: longContent }],
      });
      const edits = result.edits as Array<Record<string, unknown>>;
      expect(edits[0]?.content).toBe(`${"z".repeat(500)}... (truncated)`);
    });

    it("truncates content within single object edits", () => {
      const longContent = "z".repeat(600);
      const result = sanitizeToolInput("Write", {
        edits: { file_path: "/a.ts", content: longContent },
      });
      const edit = result.edits as Record<string, unknown>;
      expect(edit.content).toBe(`${"z".repeat(500)}... (truncated)`);
    });
  });

  describe("unrecognized tools", () => {
    it("passes through all fields unchanged for Bash", () => {
      const input = { command: "git status" };
      expect(sanitizeToolInput("Bash", input)).toEqual(input);
    });

    it("passes through all fields unchanged for unknown tools", () => {
      const input = { url: "https://example.com", prompt: "summarize" };
      expect(sanitizeToolInput("WebFetch", input)).toEqual(input);
    });
  });
});
