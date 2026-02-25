import { MILLISECONDS_PER_MINUTE } from "@hardlydifficult/date-time";

/**
 * Calculate when to schedule proactive token refresh. Uses the later of:
 *
 * - 50% of token lifetime (protects short-lived tokens)
 * - 2 minutes before expiry (ensures adequate buffer for longer tokens)
 *
 * Examples:
 *
 * - 60-second token: refresh at 30s (50% rule wins)
 * - 5-minute token: refresh at 3min (2-min buffer wins)
 * - 1-hour token: refresh at 58min (2-min buffer wins)
 *
 * @param issuedAt - Timestamp when token was issued (ms since epoch)
 * @param expiresAt - Timestamp when token expires (ms since epoch)
 * @returns Timestamp when refresh should be scheduled (ms since epoch)
 */
export function calculateTokenRefreshTime(
  issuedAt: number,
  expiresAt: number
): number {
  const lifetimeMs = expiresAt - issuedAt;
  const twoMinutesMs = 2 * MILLISECONDS_PER_MINUTE;

  const halfLifetime = issuedAt + Math.floor(lifetimeMs / 2);
  const twoMinutesBefore = expiresAt - twoMinutesMs;

  return Math.max(halfLifetime, twoMinutesBefore);
}
