import { describe, expect, it } from "vitest";

import { parsePath } from "../src/parsePath.js";

describe("parsePath", () => {
  it("parses a plain file path", () => {
    expect(parsePath("src/index.ts")).toEqual({ filePath: "src/index.ts" });
  });

  it("parses a single line range", () => {
    expect(parsePath("src/index.ts#L8")).toEqual({
      filePath: "src/index.ts",
      startLine: 8,
      endLine: 8,
    });
  });

  it("normalizes reversed ranges", () => {
    expect(parsePath("src/index.ts#L20-L10")).toEqual({
      filePath: "src/index.ts",
      startLine: 10,
      endLine: 20,
    });
  });

  it("treats invalid line values as part of the file path", () => {
    expect(parsePath("src/index.ts#L0")).toEqual({ filePath: "src/index.ts#L0" });
    expect(parsePath("src/index.ts#L-1")).toEqual({ filePath: "src/index.ts#L-1" });
  });
});
