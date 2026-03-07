import { describe, it, expect } from "vitest";
import { bottomUp } from "../src/bottomUp";
import { groupByDepth } from "../src/groupByDepth";

describe("bottomUp", () => {
  it("groups paths deepest-first without exposing depth metadata", () => {
    const result = bottomUp(["src/a/b", "src/a", "src", "src/c"]);

    expect(result).toEqual([["src/a/b"], ["src/a", "src/c"], ["src"]]);
  });

  it("handles root paths and empty input", () => {
    expect(bottomUp(["src", ""])).toEqual([["src"], [""]]);
    expect(bottomUp([])).toEqual([]);
  });

  it("ignores repeated and trailing slashes when computing depth", () => {
    expect(bottomUp(["src///nested/", "src/", "/"])).toEqual([
      ["src///nested/"],
      ["src/"],
      ["/"],
    ]);
  });

  it("preserves order within each depth group", () => {
    expect(bottomUp(["z/b", "a/c", "m/a"])).toEqual([["z/b", "a/c", "m/a"]]);
  });
});

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
    expect(groupByDepth(["src", ""])).toEqual([
      { depth: 1, paths: ["src"] },
      { depth: 0, paths: [""] },
    ]);
  });

  it("groups all paths at the same depth together", () => {
    const result = groupByDepth(["a/x", "b/y", "c/z"]);

    expect(result).toEqual([{ depth: 2, paths: ["a/x", "b/y", "c/z"] }]);
  });

  it("works with deeply nested paths", () => {
    const result = groupByDepth(["a/b/c/d/e", "a/b/c", "a"]);

    expect(result).toEqual([
      { depth: 5, paths: ["a/b/c/d/e"] },
      { depth: 3, paths: ["a/b/c"] },
      { depth: 1, paths: ["a"] },
    ]);
  });

  it("normalizes repeated and trailing slashes when computing depth", () => {
    expect(groupByDepth(["src///nested/", "src/", "/"])).toEqual([
      { depth: 2, paths: ["src///nested/"] },
      { depth: 1, paths: ["src/"] },
      { depth: 0, paths: ["/"] },
    ]);
  });
});
