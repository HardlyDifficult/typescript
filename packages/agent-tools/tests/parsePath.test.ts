import { describe, it, expect } from "vitest";
import { parsePath } from "../src/parsePath.js";

describe("parsePath", () => {
  it("parses a plain file path", () => {
    expect(parsePath("src/index.ts")).toEqual({
      filePath: "src/index.ts",
      startLine: undefined,
      endLine: undefined,
    });
  });

  it("parses a file path with a single line", () => {
    expect(parsePath("src/index.ts#L10")).toEqual({
      filePath: "src/index.ts",
      startLine: 10,
      endLine: 10,
    });
  });

  it("parses a file path with a line range", () => {
    expect(parsePath("src/index.ts#L10-L20")).toEqual({
      filePath: "src/index.ts",
      startLine: 10,
      endLine: 20,
    });
  });

  it("normalizes reversed line ranges", () => {
    expect(parsePath("src/index.ts#L20-L10")).toEqual({
      filePath: "src/index.ts",
      startLine: 10,
      endLine: 20,
    });
  });

  it("treats invalid line values as part of the path", () => {
    expect(parsePath("src/index.ts#L0")).toEqual({
      filePath: "src/index.ts#L0",
      startLine: undefined,
      endLine: undefined,
    });
  });
});
