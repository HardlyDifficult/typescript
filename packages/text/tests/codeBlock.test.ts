import { describe, expect, it } from "vitest";

import { codeBlock } from "../src/codeBlock.js";

describe("codeBlock", () => {
  it("wraps content in triple backticks by default", () => {
    expect(codeBlock("hello world")).toBe("```\nhello world\n```");
  });

  it("includes the language when provided", () => {
    expect(codeBlock("const x = 1;", "ts")).toBe(
      "```ts\nconst x = 1;\n```"
    );
  });

  it("uses a longer fence when content already contains triple backticks", () => {
    expect(codeBlock("content with ``` inside")).toBe(
      "````\ncontent with ``` inside\n````"
    );
  });

  it("preserves trailing newlines in the content", () => {
    expect(codeBlock("line 1\nline 2\n")).toBe("```\nline 1\nline 2\n```");
  });

  it("handles empty content", () => {
    expect(codeBlock("")).toBe("```\n\n```");
  });
});
