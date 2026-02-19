import { timingSafeEqual } from "crypto";

/**
 * Timing-safe string comparison to prevent brute-force attacks.
 * Always takes constant time regardless of where strings differ.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    // Compare bufA against itself so the timing is consistent
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
