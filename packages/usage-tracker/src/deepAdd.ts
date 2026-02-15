import type { DeepPartial, NumericRecord } from "./types.js";

/**
 * Recursively adds numeric values from source into target. Mutates target in place.
 * Keys in source that are not present in target are ignored.
 */
export function deepAdd<T extends NumericRecord>(
  target: T,
  source: DeepPartial<T>
): void {
  const src = source as Record<string, unknown>;
  const tgt = target as Record<string, unknown>;

  for (const key in src) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) {
      continue;
    }
    if (!(key in tgt)) {
      continue;
    }

    const sourceValue = src[key];
    const targetValue = tgt[key];

    if (typeof sourceValue === "number" && typeof targetValue === "number") {
      tgt[key] = targetValue + sourceValue;
    } else if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      typeof targetValue === "object" &&
      targetValue !== null
    ) {
      deepAdd(
        targetValue as NumericRecord,
        sourceValue as DeepPartial<NumericRecord>
      );
    }
  }
}
