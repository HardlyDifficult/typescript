import { describe, it, expect } from "vitest";
import { safeCompare } from "../src/safeCompare.js";

describe("safeCompare", () => {
  it("returns true for equal strings", () => {
    expect(safeCompare("hello", "hello")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(safeCompare("hello", "world")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(safeCompare("short", "longer string")).toBe(false);
  });

  it("returns false for empty vs non-empty", () => {
    expect(safeCompare("", "something")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(safeCompare("", "")).toBe(true);
  });

  it("handles unicode strings", () => {
    expect(safeCompare("héllo", "héllo")).toBe(true);
    expect(safeCompare("héllo", "hello")).toBe(false);
  });
});
