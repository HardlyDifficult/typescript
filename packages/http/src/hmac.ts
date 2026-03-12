import { createHmac, timingSafeEqual } from "crypto";

/** Default maximum age (ms) for an HMAC-signed request before it is rejected. */
const DEFAULT_TOLERANCE_MS = 30 * 60 * 1000; // 30 minutes

export interface VerifyHmacSignatureOptions {
  /**
   * How far in the past (in milliseconds) a timestamp may be before the
   * request is rejected for replay-attack protection.
   *
   * Only past timestamps are rejected — future timestamps are accepted to
   * tolerate clock skew, matching the behaviour of the ElevenLabs and Stripe
   * SDKs.
   *
   * @default 1_800_000 (30 minutes)
   */
  toleranceMs?: number;
}

/**
 * Verify a webhook HMAC-SHA256 signature.
 *
 * Supports the common `t=<unix_seconds>,v0=<hex>` header format used by
 * ElevenLabs, Stripe, GitHub, and many other webhook providers.
 *
 * The signed payload is `<timestamp>.<rawBody>` and the expected digest is
 * prefixed with `v0=` before the timing-safe comparison (e.g. `v0=<hex>`).
 *
 * @param header   The raw value of the signature header (e.g. `elevenlabs-signature`).
 * @param rawBody  The raw request body string (before any JSON parsing).
 * @param secret   The webhook signing secret.
 * @param options  Optional configuration.
 * @returns `true` if the signature is valid and the timestamp is within the
 *          tolerance window, `false` otherwise.
 */
export function verifyHmacSignature(
  header: string,
  rawBody: string,
  secret: string,
  options?: VerifyHmacSignatureOptions
): boolean {
  const toleranceMs = options?.toleranceMs ?? DEFAULT_TOLERANCE_MS;

  const parts = header.split(",");
  let timestamp: string | undefined;
  let signature: string | undefined;
  for (const part of parts) {
    if (part.startsWith("t=")) {
      timestamp = part.substring(2);
    } else if (part.startsWith("v0=")) {
      signature = part; // keep full "v0=<hex>" to match header format
    }
  }

  if (timestamp === undefined || signature === undefined) {
    return false;
  }

  // Reject if the timestamp is too old (replay protection).
  // Only reject past timestamps — future timestamps are accepted to tolerate
  // clock skew, matching the official ElevenLabs and Stripe SDK behaviour.
  const reqTimestampMs = Number(timestamp) * 1000;
  const cutoff = Date.now() - toleranceMs;
  if (Number.isNaN(reqTimestampMs) || reqTimestampMs < cutoff) {
    return false;
  }

  // Compute expected digest with "v0=" prefix to match header format
  const expected = `v0=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;

  // Timing-safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (sigBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(sigBuf, expectedBuf);
}
