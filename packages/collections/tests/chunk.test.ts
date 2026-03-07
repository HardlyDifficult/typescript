import { describe, it, expect } from "vitest";
import { chunk } from "../src/chunk";
import { inBatches } from "../src/inBatches";

const batchingFunctions = [
  { name: "chunk", batch: chunk },
  { name: "inBatches", batch: inBatches },
] as const;

for (const { name, batch } of batchingFunctions) {
  describe(name, () => {
    it("splits an array into chunks of the given size", () => {
      expect(batch([1, 2, 3, 4, 5, 6], 2)).toEqual([
        [1, 2],
        [3, 4],
        [5, 6],
      ]);
    });

    it("handles a final chunk smaller than size", () => {
      expect(batch([1, 2, 3, 4, 5], 3)).toEqual([
        [1, 2, 3],
        [4, 5],
      ]);
    });

    it("returns the whole array in one chunk when size >= length", () => {
      expect(batch([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
      expect(batch([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
    });

    it("returns an empty array for empty input", () => {
      expect(batch([], 3)).toEqual([]);
    });

    it("handles size of 1", () => {
      expect(batch(["a", "b", "c"], 1)).toEqual([["a"], ["b"], ["c"]]);
    });

    it("works with readonly arrays", () => {
      const items: readonly string[] = ["a", "b", "c", "d"];
      expect(batch(items, 2)).toEqual([
        ["a", "b"],
        ["c", "d"],
      ]);
    });

    it("throws when size is zero or negative", () => {
      expect(() => batch([1, 2, 3], 0)).toThrowError(RangeError);
      expect(() => batch([1, 2, 3], -1)).toThrowError(
        "size must be a positive integer"
      );
    });

    it("throws when size is not an integer", () => {
      expect(() => batch([1, 2, 3], 1.5)).toThrowError(
        "size must be a positive integer"
      );
    });
  });
}
