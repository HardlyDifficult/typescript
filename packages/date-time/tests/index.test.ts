import { describe, expect, it, vi } from "vitest";

// Import from index to ensure index.ts is covered
import {
  dateFromUnixSeconds,
  duration,
  formatClockTime,
} from "../src/index.js";

describe("index re-exports", () => {
  it("re-exports dateFromUnixSeconds", () => {
    expect(dateFromUnixSeconds(0)).toEqual(new Date("1970-01-01T00:00:00.000Z"));
  });

  it("re-exports duration", () => {
    expect(duration({ seconds: 1 })).toBe(1000);
  });

  it("re-exports formatClockTime", () => {
    const utc = Date.parse("2026-01-01T05:06:07.000Z");
    expect(formatClockTime(utc, "UTC")).toBe("05:06:07");
  });
});

describe("formatClockTime midnight normalization", () => {
  it("normalizes 24:xx:xx to 00:xx:xx when ICU renders midnight that way", () => {
    // Patch Intl.DateTimeFormat to simulate a runtime that outputs "24:00:00"
    const OriginalDateTimeFormat = Intl.DateTimeFormat;

    class MockDateTimeFormat {
      format() {
        return "24:00:00";
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = MockDateTimeFormat;

    try {
      const utc = Date.parse("2026-01-01T05:00:00.000Z");
      expect(formatClockTime(utc, "UTC")).toBe("00:00:00");
    } finally {
      // Restore original
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Intl as any).DateTimeFormat = OriginalDateTimeFormat;
    }
  });
});
