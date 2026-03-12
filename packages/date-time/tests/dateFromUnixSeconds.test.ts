import { describe, expect, it } from "vitest";

import { dateFromUnixSeconds } from "../src/dateFromUnixSeconds.js";

describe("dateFromUnixSeconds", () => {
  it("throws for empty string input", () => {
    expect(() => dateFromUnixSeconds("")).toThrow(
      "dateFromUnixSeconds(...) requires a numeric value"
    );
  });

  it("throws for whitespace-only string input", () => {
    expect(() => dateFromUnixSeconds("   ")).toThrow(
      "dateFromUnixSeconds(...) requires a numeric value"
    );
  });

  it("throws for non-finite string input", () => {
    expect(() => dateFromUnixSeconds("Infinity")).toThrow(
      "dateFromUnixSeconds(...) requires a finite numeric value"
    );
  });

  it("throws for NaN string input", () => {
    expect(() => dateFromUnixSeconds("NaN")).toThrow(
      "dateFromUnixSeconds(...) requires a finite numeric value"
    );
  });
});
