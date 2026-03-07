import { describe, expect, it } from "vitest";

import { formatClockTime } from "../src/formatClockTime.js";

describe("formatClockTime", () => {
  it("formats as Eastern time by default (EST)", () => {
    const utc = Date.parse("2026-01-01T05:06:07.000Z");
    expect(formatClockTime(utc)).toBe("00:06:07");
  });

  it("formats as Eastern time by default (EDT)", () => {
    const utc = Date.parse("2026-07-01T05:06:07.000Z");
    expect(formatClockTime(utc)).toBe("01:06:07");
  });

  it("supports overriding the timezone", () => {
    const utc = Date.parse("2026-01-01T05:06:07.000Z");
    expect(formatClockTime(utc, "UTC")).toBe("05:06:07");
  });
});
