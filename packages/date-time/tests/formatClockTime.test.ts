import { describe, expect, it } from "vitest";

import { formatClockTime } from "../src/formatClockTime.js";

describe("formatClockTime", () => {
  it("formats as local HH:mm:ss", () => {
    const date = new Date(2026, 0, 1, 5, 6, 7, 0);
    expect(formatClockTime(date.getTime())).toBe("05:06:07");
  });
});
