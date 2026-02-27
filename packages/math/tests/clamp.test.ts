import { describe, expect, it } from "vitest";

import { clamp } from "../src/clamp.js";

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min when below range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps to max when above range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("handles min equal to max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});
