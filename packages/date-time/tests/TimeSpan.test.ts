import { describe, it, expect } from "vitest";
import {
  daysToMilliseconds,
  hoursToMilliseconds,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_HOUR,
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_SECOND,
  minutesToMilliseconds,
  secondsToMilliseconds,
  toMilliseconds,
  type TimeSpan,
} from "../src/TimeSpan";

describe("duration constants", () => {
  it("should expose standard conversion constants", () => {
    expect(MILLISECONDS_PER_SECOND).toBe(1_000);
    expect(MILLISECONDS_PER_MINUTE).toBe(60_000);
    expect(MILLISECONDS_PER_HOUR).toBe(3_600_000);
    expect(MILLISECONDS_PER_DAY).toBe(86_400_000);
  });
});

describe("toMilliseconds", () => {
  it("should convert milliseconds", () => {
    const span: TimeSpan = { value: 500, unit: "milliseconds" };
    expect(toMilliseconds(span)).toBe(500);
  });

  it("should convert seconds", () => {
    const span: TimeSpan = { value: 2, unit: "seconds" };
    expect(toMilliseconds(span)).toBe(2_000);
  });

  it("should convert minutes", () => {
    const span: TimeSpan = { value: 1.5, unit: "minutes" };
    expect(toMilliseconds(span)).toBe(90_000);
  });

  it("should convert hours", () => {
    const span: TimeSpan = { value: 1, unit: "hours" };
    expect(toMilliseconds(span)).toBe(3_600_000);
  });

  it("should convert days", () => {
    const span: TimeSpan = { value: 1, unit: "days" };
    expect(toMilliseconds(span)).toBe(86_400_000);
  });

  it("should handle fractional values", () => {
    const span: TimeSpan = { value: 0.5, unit: "seconds" };
    expect(toMilliseconds(span)).toBe(500);
  });

  it("should handle zero", () => {
    const span: TimeSpan = { value: 0, unit: "minutes" };
    expect(toMilliseconds(span)).toBe(0);
  });
});

describe("unit conversion helpers", () => {
  it("should convert seconds", () => {
    expect(secondsToMilliseconds(2.5)).toBe(2_500);
  });

  it("should convert minutes", () => {
    expect(minutesToMilliseconds(1.5)).toBe(90_000);
  });

  it("should convert hours", () => {
    expect(hoursToMilliseconds(1.25)).toBe(4_500_000);
  });

  it("should convert days", () => {
    expect(daysToMilliseconds(0.5)).toBe(43_200_000);
  });
});
