import { describe, it, expect } from "vitest";
import { escapeFence } from "../src/escapeFence.js";

describe("escapeFence", () => {
  it("uses triple backticks for content without backticks", () => {
    const result = escapeFence("hello world");
    expect(result.fence).toBe("```");
    expect(result.content).toBe("hello world");
  });

  it("uses triple backticks for content with fewer than 3 consecutive backticks", () => {
    const result = escapeFence("content with `` two backticks");
    expect(result.fence).toBe("```");
  });

  it("uses quadruple backticks when content contains triple backticks", () => {
    const result = escapeFence("content with ``` triple backticks");
    expect(result.fence).toBe("````");
  });

  it("uses 5 backticks when content contains quadruple backticks", () => {
    const result = escapeFence("content with ```` four backticks");
    expect(result.fence).toBe("`````");
  });

  it("handles empty string", () => {
    const result = escapeFence("");
    expect(result.fence).toBe("```");
    expect(result.content).toBe("");
  });

  it("returns original content unchanged", () => {
    const original = "some ```code``` here";
    const result = escapeFence(original);
    expect(result.content).toBe(original);
  });
});
