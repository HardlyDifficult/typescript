import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { formatYaml } from "../src/formatYaml";

describe("formatYaml", () => {
  describe("basic serialization", () => {
    it("should serialize a simple object", () => {
      const result = formatYaml({ name: "Alice", age: 30 });
      expect(result).toContain("name: Alice");
      expect(result).toContain("age: 30");
    });

    it("should round-trip through parse", () => {
      const data = { name: "Alice", count: 42, active: true };
      const yaml = formatYaml(data);
      expect(parseYaml(yaml)).toEqual(data);
    });

    it("should serialize arrays", () => {
      const result = formatYaml({ items: ["a", "b", "c"] });
      expect(result).toContain("- a");
      expect(result).toContain("- b");
      expect(result).toContain("- c");
    });
  });

  describe("block literal for long strings with colons", () => {
    it("should use block literal for long strings containing colon-space", () => {
      const purpose =
        "Core AI SDK implementation: LLM integrations (Anthropic Claude, Ollama), agent orchestration with streaming.";
      const result = formatYaml({ purpose });
      expect(result).toContain("purpose: |");
      expect(result).not.toContain('"');
    });

    it("should indent block literal content under the key", () => {
      const purpose =
        "Core AI SDK implementation: LLM integrations and agent orchestration with streaming support.";
      const result = formatYaml({ purpose });
      const lines = result.split("\n");
      // Uses |- (strip chomp) since input has no trailing newline
      expect(lines[0]).toBe("purpose: |-");
      expect(lines[1]).toMatch(/^ {2}Core AI SDK/);
    });

    it("should not wrap long lines", () => {
      const longPurpose =
        "Core AI SDK implementation: LLM integrations (Anthropic Claude, Ollama), agent orchestration with streaming/usage tracking, and robust response parsing (JSON, code blocks, typed schemas).";
      const result = formatYaml({ purpose: longPurpose });
      const contentLines = result.split("\n").filter((l) => l.startsWith("  "));
      expect(contentLines).toHaveLength(1);
      expect(contentLines[0].trim()).toBe(longPurpose);
    });

    it("should round-trip block literal values through parse", () => {
      const purpose =
        "Implementation details: handles edge cases, parsing, and validation for multiple formats.";
      const yaml = formatYaml({ purpose });
      const parsed = parseYaml(yaml);
      // |- (strip chomp) preserves the value exactly
      expect(parsed.purpose).toBe(purpose);
    });
  });

  describe("preserves plain scalars for short/safe strings", () => {
    it("should keep short strings with colons quoted", () => {
      const result = formatYaml({ label: "main: entry" });
      expect(result).not.toContain("|");
    });

    it("should keep SHA hashes as plain scalars", () => {
      const result = formatYaml({
        sha: "3dfc0b60591e167f743c0587f87f51b10af64c31",
      });
      expect(result).toContain("sha: 3dfc0b60591e167f743c0587f87f51b10af64c31");
      expect(result).not.toContain("|");
      expect(result).not.toContain('"');
    });

    it("should keep long strings WITHOUT colons as plain scalars", () => {
      const description =
        "This is a long description that does not contain any special YAML characters and should remain plain";
      const result = formatYaml({ description });
      expect(result).not.toContain("|");
      expect(result).not.toContain('"');
    });

    it("should not convert strings at exactly 60 chars with colon", () => {
      const value = "A".repeat(55) + ": BB"; // exactly 60 chars
      const result = formatYaml({ key: value });
      expect(result).not.toContain("key: |");
    });

    it("should convert strings at 61 chars with colon", () => {
      const value = "A".repeat(57) + ": BB"; // 61 chars
      const result = formatYaml({ key: value });
      expect(result).toContain("key: |");
    });
  });

  describe("real-world summary data", () => {
    it("should format a file summary with purpose and key_sections", () => {
      const summary = {
        purpose:
          "Core AI SDK implementation: LLM integrations (Anthropic Claude, Ollama), agent orchestration with streaming/usage tracking, and robust response parsing (JSON, code blocks, typed schemas).",
        key_sections: [
          {
            lines: "1-10",
            label: "imports",
            description: "Module imports and type re-exports.",
          },
          {
            lines: "12-50",
            label: "createAI",
            description:
              "Factory function: creates AI client with model, tracker, and logger dependencies.",
          },
        ],
        sha: "3dfc0b60591e167f743c0587f87f51b10af64c31",
      };

      const result = formatYaml(summary);

      // Purpose should be block literal (long, has colons)
      expect(result).toContain("purpose: |");

      // SHA should be plain
      expect(result).toContain(
        "sha: 3dfc0b60591e167f743c0587f87f51b10af64c31"
      );

      // Lines and labels stay as plain scalars (no quotes needed)
      expect(result).toContain("lines: 1-10");
      expect(result).toContain("label: imports");

      // The output should parse back correctly
      const parsed = parseYaml(result);
      expect(parsed.sha).toBe(summary.sha);
      expect(parsed.key_sections).toHaveLength(2);
    });

    it("should format a directory summary", () => {
      const summary = {
        purpose:
          "Service orchestration layer: manages PR scanning, code review, task creation, and workflow execution across GitHub repositories.",
        sha: "abc123def456",
      };

      const result = formatYaml(summary);
      expect(result).toContain("purpose: |");
      expect(result).toContain("sha: abc123def456");
      expect(result).not.toContain('"abc123def456"');
    });
  });

  describe("edge cases", () => {
    it("should handle empty object", () => {
      const result = formatYaml({});
      expect(result).toBe("{}\n");
    });

    it("should handle deeply nested structures", () => {
      const data = {
        level1: {
          level2: {
            description:
              "Deeply nested value with colon: should still use block literal for readability.",
          },
        },
      };
      const result = formatYaml(data);
      expect(result).toContain("description: |");
    });

    it("should handle multiple long-colon strings", () => {
      const data = {
        purpose:
          "Main purpose: does many things including orchestration and management.",
        summary:
          "Summary section: provides overview of system capabilities and integration points.",
      };
      const result = formatYaml(data);
      expect(result).toContain("purpose: |");
      expect(result).toContain("summary: |");
    });

    it("should handle strings with multiple colons", () => {
      const value =
        "First part: second part: third part and more content to exceed the threshold.";
      const result = formatYaml({ key: value });
      expect(result).toContain("key: |");
      const parsed = parseYaml(result);
      // |- (strip chomp) preserves the value exactly
      expect(parsed.key).toBe(value);
    });
  });
});
