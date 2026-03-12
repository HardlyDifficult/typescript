import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isWithinWorkingHours,
  matchesWorkPattern,
  type WorkingHoursConfig,
  type WorkPatternConfig,
} from "../src/workingHours.js";

const ET_CONFIG: WorkingHoursConfig = {
  startHour: 7,
  endHour: 17,
  timezone: "America/New_York",
};

describe("isWithinWorkingHours", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true during weekday business hours", () => {
    // Wednesday 2025-01-15 at 12:00 ET (17:00 UTC)
    vi.setSystemTime(new Date("2025-01-15T17:00:00Z"));
    expect(isWithinWorkingHours(ET_CONFIG)).toBe(true);
  });

  it("returns true at start hour boundary", () => {
    // Wednesday 2025-01-15 at 07:00 ET (12:00 UTC)
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
    expect(isWithinWorkingHours(ET_CONFIG)).toBe(true);
  });

  it("returns false at end hour boundary", () => {
    // Wednesday 2025-01-15 at 17:00 ET (22:00 UTC)
    vi.setSystemTime(new Date("2025-01-15T22:00:00Z"));
    expect(isWithinWorkingHours(ET_CONFIG)).toBe(false);
  });

  it("returns false before start hour", () => {
    // Wednesday 2025-01-15 at 06:00 ET (11:00 UTC)
    vi.setSystemTime(new Date("2025-01-15T11:00:00Z"));
    expect(isWithinWorkingHours(ET_CONFIG)).toBe(false);
  });

  it("returns false on Saturday", () => {
    // Saturday 2025-01-18 at 12:00 ET (17:00 UTC)
    vi.setSystemTime(new Date("2025-01-18T17:00:00Z"));
    expect(isWithinWorkingHours(ET_CONFIG)).toBe(false);
  });

  it("returns false on Sunday", () => {
    // Sunday 2025-01-19 at 12:00 ET (17:00 UTC)
    vi.setSystemTime(new Date("2025-01-19T17:00:00Z"));
    expect(isWithinWorkingHours(ET_CONFIG)).toBe(false);
  });

  it("respects different timezone", () => {
    // 10:00 UTC = 19:00 JST (within 9-18 JST? No, 19 >= 18)
    vi.setSystemTime(new Date("2025-01-15T10:00:00Z"));
    expect(
      isWithinWorkingHours({
        startHour: 9,
        endHour: 18,
        timezone: "Asia/Tokyo",
      })
    ).toBe(false);

    // 05:00 UTC = 14:00 JST (within 9-18)
    vi.setSystemTime(new Date("2025-01-15T05:00:00Z"));
    expect(
      isWithinWorkingHours({
        startHour: 9,
        endHour: 18,
        timezone: "Asia/Tokyo",
      })
    ).toBe(true);
  });
});

describe("matchesWorkPattern", () => {
  const patterns: WorkPatternConfig = {
    organizations: ["Acme-Corp", "BigCo"],
    repoNameContains: ["work", "internal"],
  };

  it("matches by organization name (case-insensitive)", () => {
    expect(matchesWorkPattern("acme-corp", "some-repo", patterns)).toBe(true);
    expect(matchesWorkPattern("ACME-CORP", "some-repo", patterns)).toBe(true);
    expect(matchesWorkPattern("bigco", "some-repo", patterns)).toBe(true);
  });

  it("matches by repo name substring (case-insensitive)", () => {
    expect(matchesWorkPattern("random-org", "my-work-project", patterns)).toBe(
      true
    );
    expect(matchesWorkPattern("random-org", "INTERNAL-tools", patterns)).toBe(
      true
    );
  });

  it("returns false when nothing matches", () => {
    expect(matchesWorkPattern("random-org", "personal-project", patterns)).toBe(
      false
    );
  });

  it("handles empty patterns", () => {
    const empty: WorkPatternConfig = {
      organizations: [],
      repoNameContains: [],
    };
    expect(matchesWorkPattern("any-org", "any-repo", empty)).toBe(false);
  });
});
