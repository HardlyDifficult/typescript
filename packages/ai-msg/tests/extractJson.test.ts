import { describe, expect, it } from "vitest";

import { extractJson } from "../src/extractJson.js";

describe("extractJson", () => {
  describe("pass 1: direct parse", () => {
    it("parses a plain JSON object", () => {
      expect(extractJson('{"key":"value"}')).toEqual({ key: "value" });
    });

    it("parses a plain JSON array", () => {
      expect(extractJson("[1,2,3]")).toEqual([1, 2, 3]);
    });

    it("parses a JSON string primitive", () => {
      expect(extractJson('"hello"')).toBe("hello");
    });

    it("parses a JSON number primitive", () => {
      expect(extractJson("42")).toBe(42);
    });

    it("parses a JSON boolean", () => {
      expect(extractJson("true")).toBe(true);
    });

    it("parses null", () => {
      expect(extractJson("null")).toBeNull();
    });

    it("trims whitespace before parsing", () => {
      expect(extractJson('  {"a":1}  ')).toEqual({ a: 1 });
    });
  });

  describe("pass 2: code blocks", () => {
    it("extracts JSON from a json-tagged code block", () => {
      const text = 'Here is the result:\n```json\n{"a":1}\n```\nDone.';
      expect(extractJson(text)).toEqual({ a: 1 });
    });

    it("extracts JSON from an untagged code block", () => {
      const text = 'Result:\n```\n{"b":2}\n```';
      expect(extractJson(text)).toEqual({ b: 2 });
    });

    it("prefers json-tagged block over untagged", () => {
      const text = '```\n{"untagged":true}\n```\n```json\n{"tagged":true}\n```';
      expect(extractJson(text)).toEqual({ tagged: true });
    });

    it("extracts array from code block", () => {
      const text = "```json\n[1,2,3]\n```";
      expect(extractJson(text)).toEqual([1, 2, 3]);
    });
  });

  describe("pass 3: balanced extraction", () => {
    it("extracts an object from surrounding prose", () => {
      const text = 'The answer is {"key":"val"} as shown above.';
      expect(extractJson(text)).toEqual({ key: "val" });
    });

    it("extracts an array from surrounding prose", () => {
      const text = "Items: [1, 2, 3] listed here.";
      expect(extractJson(text)).toEqual([1, 2, 3]);
    });

    it("handles nested braces", () => {
      const text = 'Sure: {"a":{"b":1}} done.';
      expect(extractJson(text)).toEqual({ a: { b: 1 } });
    });

    it("handles strings with braces inside", () => {
      const text = 'Here: {"msg":"hello {world}"} end.';
      expect(extractJson(text)).toEqual({ msg: "hello {world}" });
    });

    it("handles escaped quotes in strings", () => {
      const text = 'Data: {"val":"say \\"hi\\""} end.';
      expect(extractJson(text)).toEqual({ val: 'say "hi"' });
    });

    it("prefers object over array when both present", () => {
      const text = 'Got [1,2] and {"a":1} here.';
      expect(extractJson(text)).toEqual({ a: 1 });
    });
  });

  describe("failure cases", () => {
    it("returns null for plain text with no JSON", () => {
      expect(extractJson("just some text")).toBeNull();
    });

    it("returns null for invalid JSON in code block", () => {
      const text = "```json\n{invalid}\n```";
      expect(extractJson(text)).toBeNull();
    });

    it("returns null for unbalanced braces", () => {
      expect(extractJson("{ missing close")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(extractJson("")).toBeNull();
    });
  });
});
