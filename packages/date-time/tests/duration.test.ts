import { describe, expect, it } from "vitest";

import {
  dateFromUnixSeconds,
  duration,
  type DurationParts,
} from "../src/index.js";

describe("duration", () => {
  it("converts milliseconds", () => {
    const parts: DurationParts = { milliseconds: 500 };
    expect(duration(parts)).toBe(500);
  });

  it("converts seconds", () => {
    const parts: DurationParts = { seconds: 2 };
    expect(duration(parts)).toBe(2_000);
  });

  it("converts minutes", () => {
    const parts: DurationParts = { minutes: 1.5 };
    expect(duration(parts)).toBe(90_000);
  });

  it("converts hours", () => {
    const parts: DurationParts = { hours: 1 };
    expect(duration(parts)).toBe(3_600_000);
  });

  it("converts days", () => {
    const parts: DurationParts = { days: 1 };
    expect(duration(parts)).toBe(86_400_000);
  });

  it("sums mixed units", () => {
    expect(duration({ minutes: 1, seconds: 30 })).toBe(90_000);
  });

  it("supports fractional values", () => {
    expect(duration({ seconds: 0.5 })).toBe(500);
  });

  it("supports negative values", () => {
    expect(duration({ minutes: -2 })).toBe(-120_000);
  });

  it("throws when no supported fields are provided", () => {
    expect(() => duration({})).toThrow(
      "duration(...) requires at least one of: milliseconds, seconds, minutes, hours, days"
    );
  });

  it("throws when a value is NaN", () => {
    expect(() => duration({ seconds: Number.NaN })).toThrow(
      "duration(seconds) must be a finite number"
    );
  });

  it("throws when a value is infinite", () => {
    expect(() => duration({ minutes: Number.POSITIVE_INFINITY })).toThrow(
      "duration(minutes) must be a finite number"
    );
  });
});

describe("dateFromUnixSeconds", () => {
  it("parses numeric input", () => {
    expect(dateFromUnixSeconds(1_735_689_600)).toEqual(
      new Date("2025-01-01T00:00:00.000Z")
    );
  });

  it("parses numeric string input", () => {
    expect(dateFromUnixSeconds("1735689600")).toEqual(
      new Date("2025-01-01T00:00:00.000Z")
    );
  });

  it("parses fractional seconds", () => {
    expect(dateFromUnixSeconds("1735689600.5")).toEqual(
      new Date("2025-01-01T00:00:00.500Z")
    );
  });

  it("throws for invalid input", () => {
    expect(() => dateFromUnixSeconds("2025-01-01")).toThrow(
      "dateFromUnixSeconds(...) requires a finite numeric value"
    );
  });
});
