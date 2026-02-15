import { describe, it, expect } from "vitest";
import { formatDuration } from "../src/formatDuration.js";

describe("formatDuration", () => {
  it("returns <1s for sub-second durations", () => {
    expect(formatDuration(0)).toBe("<1s");
    expect(formatDuration(500)).toBe("<1s");
    expect(formatDuration(999)).toBe("<1s");
  });

  it("returns seconds only for < 1 minute", () => {
    expect(formatDuration(1000)).toBe("1s");
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(59_999)).toBe("59s");
  });

  it("returns minutes and seconds for < 1 hour", () => {
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(125_000)).toBe("2m 5s");
    expect(formatDuration(3_599_999)).toBe("59m 59s");
  });

  it("skips zero seconds", () => {
    expect(formatDuration(300_000)).toBe("5m");
  });

  it("returns hours and minutes for < 1 day", () => {
    expect(formatDuration(3_600_000)).toBe("1h");
    expect(formatDuration(3_900_000)).toBe("1h 5m");
    expect(formatDuration(86_399_999)).toBe("23h 59m");
  });

  it("skips zero minutes", () => {
    expect(formatDuration(7_200_000)).toBe("2h");
  });

  it("returns days and hours for >= 1 day", () => {
    expect(formatDuration(86_400_000)).toBe("1d");
    expect(formatDuration(104_400_000)).toBe("1d 5h");
    expect(formatDuration(2_635_200_000)).toBe("30d 12h");
  });

  it("skips zero hours", () => {
    expect(formatDuration(604_800_000)).toBe("7d");
  });
});
