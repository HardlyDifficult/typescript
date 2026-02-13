import { describe, it, expect } from "vitest";
import { chunkText } from "../src/chunkText.js";

describe("chunkText", () => {
  it("returns single chunk when text is shorter than maxLength", () => {
    expect(chunkText("short text", 100)).toEqual(["short text"]);
  });

  it("splits on newlines", () => {
    const text = "line one\nline two\nline three";
    const chunks = chunkText(text, 18);
    expect(chunks[0]).toBe("line one\nline two");
    expect(chunks[1]).toBe("line three");
  });

  it("splits on spaces when no good newline break point", () => {
    const text = "word1 word2 word3 word4 word5";
    const chunks = chunkText(text, 17);
    expect(chunks[0]).toBe("word1 word2 word3");
    expect(chunks[1]).toBe("word4 word5");
  });

  it("forces a hard break when no good break point exists", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const chunks = chunkText(text, 10);
    expect(chunks).toEqual(["abcdefghij", "klmnopqrst", "uvwxyz"]);
  });

  it("returns empty array for empty string", () => {
    expect(chunkText("", 100)).toEqual([]);
  });
});
