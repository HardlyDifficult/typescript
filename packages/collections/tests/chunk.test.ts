import { describe, it, expect } from "vitest";
import { chunk } from "../src/chunk";

describe("chunk", () => {
  it("splits an array into chunks of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5, 6], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it("handles a final chunk smaller than size", () => {
    expect(chunk([1, 2, 3, 4, 5], 3)).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
  });

  it("returns the whole array in one chunk when size >= length", () => {
    expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("handles size of 1", () => {
    expect(chunk(["a", "b", "c"], 1)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("works with readonly arrays", () => {
    const items: readonly string[] = ["a", "b", "c", "d"];
    expect(chunk(items, 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("throws when size is zero or negative", () => {
    expect(() => chunk([1, 2, 3], 0)).toThrowError(RangeError);
    expect(() => chunk([1, 2, 3], -1)).toThrowError(
      "size must be a positive integer"
    );
  });

  it("throws when size is not an integer", () => {
    expect(() => chunk([1, 2, 3], 1.5)).toThrowError(
      "size must be a positive integer"
    );
  });
});
