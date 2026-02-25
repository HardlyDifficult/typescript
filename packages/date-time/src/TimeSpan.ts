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

/** Converts seconds to milliseconds. */
export function secondsToMilliseconds(seconds: number): number {
  return seconds * MILLISECONDS_PER_SECOND;
}

/** Converts minutes to milliseconds. */
export function minutesToMilliseconds(minutes: number): number {
  return minutes * MILLISECONDS_PER_MINUTE;
}

/** Converts hours to milliseconds. */
export function hoursToMilliseconds(hours: number): number {
  return hours * MILLISECONDS_PER_HOUR;
}

/** Converts days to milliseconds. */
export function daysToMilliseconds(days: number): number {
  return days * MILLISECONDS_PER_DAY;
}
