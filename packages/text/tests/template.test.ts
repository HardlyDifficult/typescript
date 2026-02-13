import { describe, it, expect } from "vitest";
import { replaceTemplate, extractPlaceholders } from "../src/template.js";

describe("replaceTemplate", () => {
  it("replaces a single placeholder", () => {
    expect(replaceTemplate("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
  });

  it("replaces multiple placeholders", () => {
    const result = replaceTemplate("{{greeting}}, {{name}}!", {
      greeting: "Hi",
      name: "Alice",
    });
    expect(result).toBe("Hi, Alice!");
  });

  it("preserves placeholders when key is missing", () => {
    expect(replaceTemplate("Hello {{name}}!", {})).toBe("Hello {{name}}!");
  });

  it("replaces with empty string value", () => {
    expect(replaceTemplate("Hello {{name}}!", { name: "" })).toBe("Hello !");
  });
});

describe("extractPlaceholders", () => {
  it("finds unique placeholder names", () => {
    const result = extractPlaceholders("{{a}} and {{b}} and {{a}} again");
    expect(result).toEqual(["a", "b"]);
  });

  it("returns empty array for no placeholders", () => {
    expect(extractPlaceholders("no placeholders here")).toEqual([]);
  });
});
