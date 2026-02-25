import { describe, expect, it } from "vitest";
import { safeCompare } from "../src/safeCompare.js";

describe("safeCompare", () => {
  it("returns true for equal strings", () => {
    expect(safeCompare("token", "token")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(safeCompare("token-a", "token-b")).toBe(false);
  });

  it("returns false for different-length strings", () => {
    expect(safeCompare("short", "a much longer secret")).toBe(false);
    expect(safeCompare("a much longer secret", "short")).toBe(false);
  });

  it("supports unicode values", () => {
    expect(safeCompare("påsswørd", "påsswørd")).toBe(true);
    expect(safeCompare("påsswørd", "password")).toBe(false);
  });
});
