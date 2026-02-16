import { describe, it, expect } from "vitest";
import { groupByDepth } from "../src/groupByDepth";

describe("groupByDepth", () => {
  it("groups paths by depth, sorted deepest-first", () => {
    const result = groupByDepth(["src/a/b", "src/a", "src", "src/c"]);

    expect(result).toEqual([
      { depth: 3, paths: ["src/a/b"] },
      { depth: 2, paths: ["src/a", "src/c"] },
      { depth: 1, paths: ["src"] },
    ]);
  });

  it("handles empty string as depth 0 (root)", () => {
    const result = groupByDepth(["src", ""]);

    expect(result).toEqual([
      { depth: 1, paths: ["src"] },
      { depth: 0, paths: [""] },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(groupByDepth([])).toEqual([]);
  });

  it("groups all paths at the same depth together", () => {
    const result = groupByDepth(["a/x", "b/y", "c/z"]);

    expect(result).toEqual([{ depth: 2, paths: ["a/x", "b/y", "c/z"] }]);
  });

  it("preserves order within each depth group", () => {
    const result = groupByDepth(["z/b", "a/c", "m/a"]);

    expect(result[0]!.paths).toEqual(["z/b", "a/c", "m/a"]);
  });

  it("works with deeply nested paths", () => {
    const result = groupByDepth([
      "a/b/c/d/e",
      "a/b/c",
      "a",
    ]);

    expect(result).toEqual([
      { depth: 5, paths: ["a/b/c/d/e"] },
      { depth: 3, paths: ["a/b/c"] },
      { depth: 1, paths: ["a"] },
    ]);
  });
});
