import { describe, expect, it } from "vitest";

import { extractCodeBlock } from "../src/extractCodeBlock.js";

describe("extractCodeBlock", () => {
  it("extracts a single code block", () => {
    const text = "Here is some code:\n```js\nconsole.log('hi');\n```\nDone.";
    expect(extractCodeBlock(text)).toEqual(["console.log('hi');"]);
  });

  it("extracts multiple code blocks", () => {
    const text = "```ts\nconst a = 1;\n```\nand\n```ts\nconst b = 2;\n```";
    expect(extractCodeBlock(text)).toEqual(["const a = 1;", "const b = 2;"]);
  });

  it("filters by language tag", () => {
    const text = '```json\n{"a":1}\n```\n```ts\nconst x = 1;\n```';
    expect(extractCodeBlock(text, "json")).toEqual(['{"a":1}']);
  });

  it("filters by language tag case-insensitively", () => {
    const text = '```JSON\n{"a":1}\n```';
    expect(extractCodeBlock(text, "json")).toEqual(['{"a":1}']);
  });

  it("returns empty array when no blocks found", () => {
    expect(extractCodeBlock("no code here")).toEqual([]);
  });

  it("returns empty array when lang filter has no matches", () => {
    const text = "```ts\nconst x = 1;\n```";
    expect(extractCodeBlock(text, "python")).toEqual([]);
  });

  it("extracts untagged code blocks", () => {
    const text = "```\nhello world\n```";
    expect(extractCodeBlock(text)).toEqual(["hello world"]);
  });

  it("does not match untagged blocks when lang is specified", () => {
    const text = "```\nhello world\n```";
    expect(extractCodeBlock(text, "json")).toEqual([]);
  });

  it("trims trailing whitespace from content", () => {
    const text = "```\nhello  \n\n```";
    expect(extractCodeBlock(text)).toEqual(["hello"]);
  });

  it("preserves internal newlines", () => {
    const text = "```\nline1\nline2\nline3\n```";
    expect(extractCodeBlock(text)).toEqual(["line1\nline2\nline3"]);
  });
});
