import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Uses crypto.timingSafeEqual under the hood. Handles different-length
 * strings safely by comparing against a same-length dummy first (so the
 * comparison always runs in time proportional to `a.length`).
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    // Compare bufA against itself so the timing is consistent,
    // then return false.
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
