import { describe, expect, it } from "vitest";

import { parseFileReference } from "../src/parseFileReference.js";

describe("parseFileReference", () => {
  it("parses a plain file path", () => {
    expect(parseFileReference("src/index.ts")).toEqual({
      path: "src/index.ts",
    });
  });

  it("parses a single line range", () => {
    expect(parseFileReference("src/index.ts#L8")).toEqual({
      path: "src/index.ts",
      lines: {
        start: 8,
        end: 8,
      },
    });
  });

  it("normalizes reversed ranges", () => {
    expect(parseFileReference("src/index.ts#L20-L10")).toEqual({
      path: "src/index.ts",
      lines: {
        start: 10,
        end: 20,
      },
    });
  });

  it("treats invalid line values as part of the file path", () => {
    expect(parseFileReference("src/index.ts#L0")).toEqual({
      path: "src/index.ts#L0",
    });
    expect(parseFileReference("src/index.ts#L-1")).toEqual({
      path: "src/index.ts#L-1",
    });
  });
});
