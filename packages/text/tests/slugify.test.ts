import { describe, it, expect } from "vitest";
import { slugify } from "../src/slugify.js";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("My Feature Name")).toBe("my-feature-name");
  });

  it("removes non-alphanumeric characters", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
  });

  it("collapses consecutive non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("hello   world!!!")).toBe("hello-world");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("handles leading and trailing whitespace", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("returns empty string for non-alphanumeric input", () => {
    expect(slugify("!@#$%")).toBe("");
  });

  it("truncates to maxLength at hyphen boundary", () => {
    expect(slugify("my-feature-name", 10)).toBe("my-feature");
  });

  it("truncates mid-word when no hyphen exists within limit", () => {
    expect(slugify("superlongword", 5)).toBe("super");
  });

  it("does not truncate when within maxLength", () => {
    expect(slugify("short", 50)).toBe("short");
  });

  it("handles maxLength exactly at word boundary", () => {
    expect(slugify("hello-world", 5)).toBe("hello");
  });

  it("preserves numbers", () => {
    expect(slugify("Version 2.0 Release")).toBe("version-2-0-release");
  });
});
