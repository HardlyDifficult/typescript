export type TimeUnit =
  | "milliseconds"
  | "seconds"
  | "minutes"
  | "hours"
  | "days";

export interface TimeSpan {
  value: number;
  unit: TimeUnit;
}

/** Number of milliseconds in one second. */
export const MILLISECONDS_PER_SECOND = 1_000;
/** Number of milliseconds in one minute. */
export const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
/** Number of milliseconds in one hour. */
export const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
/** Number of milliseconds in one day. */
export const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

const multipliers: Record<TimeUnit, number> = {
  milliseconds: 1,
  seconds: MILLISECONDS_PER_SECOND,
  minutes: MILLISECONDS_PER_MINUTE,
  hours: MILLISECONDS_PER_HOUR,
  days: MILLISECONDS_PER_DAY,
};

/** Converts a TimeSpan to its equivalent value in milliseconds. */
export function toMilliseconds(timeSpan: TimeSpan): number {
  return timeSpan.value * multipliers[timeSpan.unit];
}
