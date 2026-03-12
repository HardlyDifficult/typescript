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

  it("throws for overflow value that produces an invalid Date", () => {
    // Number.MAX_VALUE is finite, but MAX_VALUE * 1000 = Infinity, making the Date invalid
    expect(() => dateFromUnixSeconds(Number.MAX_VALUE)).toThrow(
      "Invalid Unix timestamp in seconds"
    );
  });
});
