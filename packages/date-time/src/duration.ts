export interface DurationParts {
  milliseconds?: number;
  seconds?: number;
  minutes?: number;
  hours?: number;
  days?: number;
}

const MILLISECONDS_PER_UNIT = {
  milliseconds: 1,
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
} as const satisfies Record<keyof DurationParts, number>;

/**
 * Converts one or more duration parts into milliseconds.
 */
export function duration(parts: DurationParts): number {
  let hasSupportedField = false;
  let totalMilliseconds = 0;

  for (const unit of Object.keys(MILLISECONDS_PER_UNIT) as Array<
    keyof DurationParts
  >) {
    const value = parts[unit];
    if (value === undefined) {
      continue;
    }

    hasSupportedField = true;
    if (!Number.isFinite(value)) {
      throw new Error(`duration(${unit}) must be a finite number`);
    }
    totalMilliseconds += value * MILLISECONDS_PER_UNIT[unit];
  }

  if (!hasSupportedField) {
    throw new Error(
      "duration(...) requires at least one of: milliseconds, seconds, minutes, hours, days"
    );
  }

  return totalMilliseconds;
}
