import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Pads both values to the same length before comparing so the timing-safe
 * compare path is always executed, even for different-length inputs.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  const maxLength = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(maxLength);
  const paddedB = Buffer.alloc(maxLength);

  bufA.copy(paddedA);
  bufB.copy(paddedB);

  const valuesMatch = timingSafeEqual(paddedA, paddedB);

  return bufA.length === bufB.length && valuesMatch;
}
