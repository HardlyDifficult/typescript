import { describe, expect, it } from "vitest";

import { extractTextContent, toPlainTextMessages } from "../src/multimodal.js";

describe("extractTextContent", () => {
  it("returns the string when given a plain string", () => {
    expect(extractTextContent("hello world")).toBe("hello world");
  });

  it("joins text blocks with newline", () => {
    const content = [
      { type: "text", text: "first" },
      { type: "text", text: "second" },
    ];
    expect(extractTextContent(content)).toBe("first\nsecond");
  });

  it("only extracts text from mixed content types", () => {
    const content = [
      { type: "text", text: "visible" },
      { type: "image", text: "should be ignored" },
      { type: "text", text: "also visible" },
    ];
    expect(extractTextContent(content)).toBe("visible\nalso visible");
  });

  it("returns empty string for an empty array", () => {
    expect(extractTextContent([])).toBe("");
  });

  it("filters out blocks missing the text field", () => {
    const content = [
      { type: "text" },
      { type: "text", text: "has text" },
      { type: "text", text: undefined as unknown as string },
    ];
    expect(extractTextContent(content)).toBe("has text");
  });
});

describe("toPlainTextMessages", () => {
  it("converts multimodal messages to plain text", () => {
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text", text: "hello" },
          { type: "image" },
          { type: "text", text: "world" },
        ],
      },
      {
        role: "assistant" as const,
        content: [{ type: "text", text: "response" }],
      },
    ];
    const result = toPlainTextMessages(messages);
    expect(result).toEqual([
      { role: "user", content: "hello\nworld" },
      { role: "assistant", content: "response" },
    ]);
  });

  it("preserves roles correctly", () => {
    const messages = [
      { role: "system" as const, content: "sys" },
      { role: "user" as const, content: "usr" },
      { role: "assistant" as const, content: "ast" },
    ];
    const result = toPlainTextMessages(messages);
    expect(result[0].role).toBe("system");
    expect(result[1].role).toBe("user");
    expect(result[2].role).toBe("assistant");
  });

  it("passes through already-string content unchanged", () => {
    const messages = [{ role: "user" as const, content: "plain string" }];
    const result = toPlainTextMessages(messages);
    expect(result).toEqual([{ role: "user", content: "plain string" }]);
  });
});
