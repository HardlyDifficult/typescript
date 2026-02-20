import { describe, it, expect } from "vitest";
import { calculateTokenRefreshTime } from "../src/tokenRefresh.js";

describe("calculateTokenRefreshTime", () => {
  it("uses 50% for short-lived tokens (60s)", () => {
    const issuedAt = 1000000;
    const expiresAt = issuedAt + 60_000;

    const refreshAt = calculateTokenRefreshTime(issuedAt, expiresAt);
    expect(refreshAt).toBe(issuedAt + 30_000);
  });

  it("uses 2-min buffer for 5-minute tokens", () => {
    const issuedAt = 1000000;
    const expiresAt = issuedAt + 5 * 60_000;

    const refreshAt = calculateTokenRefreshTime(issuedAt, expiresAt);
    expect(refreshAt).toBe(expiresAt - 2 * 60_000);
  });

  it("uses 2-min buffer for 1-hour tokens", () => {
    const issuedAt = 1000000;
    const expiresAt = issuedAt + 60 * 60_000;

    const refreshAt = calculateTokenRefreshTime(issuedAt, expiresAt);
    expect(refreshAt).toBe(expiresAt - 2 * 60_000);
  });

  it("crossover point: 4-min token uses 50% (2min = 2min)", () => {
    const issuedAt = 1000000;
    const expiresAt = issuedAt + 4 * 60_000;

    const refreshAt = calculateTokenRefreshTime(issuedAt, expiresAt);
    // 50% = 2min, 2-min-before = 2min, both are equal
    expect(refreshAt).toBe(issuedAt + 2 * 60_000);
  });
});
