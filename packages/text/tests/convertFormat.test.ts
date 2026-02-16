import { describe, it, expect } from "vitest";
import { convertFormat } from "../src/convertFormat.js";

describe("convertFormat", () => {
  describe("JSON to YAML", () => {
    it("converts simple JSON object to YAML", () => {
      const json = '{"name": "Alice", "age": 30}';
      const result = convertFormat(json, "yaml");
      expect(result).toContain("name: Alice");
      expect(result).toContain("age: 30");
    });

    it("converts JSON array to YAML", () => {
      const json = '["apple", "banana", "cherry"]';
      const result = convertFormat(json, "yaml");
      expect(result).toContain("- apple");
      expect(result).toContain("- banana");
      expect(result).toContain("- cherry");
    });

    it("converts nested JSON to YAML", () => {
      const json = '{"user": {"name": "Bob", "email": "bob@example.com"}}';
      const result = convertFormat(json, "yaml");
      expect(result).toContain("user:");
      expect(result).toContain("name: Bob");
      expect(result).toContain("email: bob@example.com");
    });

    it("preserves numbers and booleans", () => {
      const json = '{"count": 42, "active": true, "ratio": 3.14}';
      const result = convertFormat(json, "yaml");
      expect(result).toContain("count: 42");
      expect(result).toContain("active: true");
      expect(result).toContain("ratio: 3.14");
    });

    it("handles empty object", () => {
      const json = "{}";
      const result = convertFormat(json, "yaml");
      expect(result).toBe("{}\n");
    });

    it("handles empty array", () => {
      const json = "[]";
      const result = convertFormat(json, "yaml");
      expect(result).toBe("[]\n");
    });
  });

  describe("YAML to JSON", () => {
    it("converts simple YAML to JSON", () => {
      const yaml = "name: Alice\nage: 30";
      const result = convertFormat(yaml, "json");
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ name: "Alice", age: 30 });
    });

    it("converts YAML array to JSON", () => {
      const yaml = "- apple\n- banana\n- cherry";
      const result = convertFormat(yaml, "json");
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(["apple", "banana", "cherry"]);
    });

    it("converts nested YAML to JSON", () => {
      const yaml = "user:\n  name: Bob\n  email: bob@example.com";
      const result = convertFormat(yaml, "json");
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({
        user: { name: "Bob", email: "bob@example.com" },
      });
    });

    it("pretty-prints JSON with 2-space indent", () => {
      const yaml = "name: Alice\nage: 30";
      const result = convertFormat(yaml, "json");
      expect(result).toBe('{\n  "name": "Alice",\n  "age": 30\n}');
    });

    it("preserves numbers and booleans", () => {
      const yaml = "count: 42\nactive: true\nratio: 3.14";
      const result = convertFormat(yaml, "json");
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ count: 42, active: true, ratio: 3.14 });
    });

    it("handles empty YAML", () => {
      const yaml = "";
      const result = convertFormat(yaml, "json");
      expect(result).toBe("null");
    });
  });

  describe("YAML to YAML (round-trip)", () => {
    it("parses and re-serializes YAML", () => {
      const yaml = "name: Alice\nage: 30";
      const result = convertFormat(yaml, "yaml");
      expect(result).toContain("name: Alice");
      expect(result).toContain("age: 30");
    });
  });

  describe("JSON to JSON (round-trip)", () => {
    it("parses and pretty-prints JSON", () => {
      const json = '{"name":"Alice","age":30}';
      const result = convertFormat(json, "json");
      expect(result).toBe('{\n  "name": "Alice",\n  "age": 30\n}');
    });
  });

  describe("error handling", () => {
    it("throws descriptive error for invalid input", () => {
      const invalid = "{ this is not valid JSON or YAML ]";
      expect(() => convertFormat(invalid, "json")).toThrow(
        "Input is neither valid JSON nor YAML"
      );
    });

    it("throws error message containing both JSON and YAML errors", () => {
      const invalid = "{ this is not valid JSON or YAML ]";
      const errorFn = () => convertFormat(invalid, "json");
      expect(errorFn).toThrow("JSON error:");
      expect(errorFn).toThrow("YAML error:");
    });
  });

  describe("special cases", () => {
    it("handles null value", () => {
      const json = "null";
      const result = convertFormat(json, "yaml");
      expect(result).toBe("null\n");
    });

    it("handles string values", () => {
      const json = '"hello world"';
      const result = convertFormat(json, "yaml");
      expect(result).toBe("hello world\n");
    });

    it("handles number values", () => {
      const json = "42";
      const result = convertFormat(json, "yaml");
      expect(result).toBe("42\n");
    });

    it("handles strings with special characters in YAML", () => {
      const yaml = 'message: "Hello: World"';
      const result = convertFormat(yaml, "json");
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ message: "Hello: World" });
    });

    it("handles multiline strings in YAML", () => {
      const yaml = "description: |\n  Line 1\n  Line 2";
      const result = convertFormat(yaml, "json");
      const parsed = JSON.parse(result);
      expect(parsed.description).toContain("Line 1");
      expect(parsed.description).toContain("Line 2");
    });
  });
});
