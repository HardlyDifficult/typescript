export type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days';

export interface TimeSpan {
  value: number;
  unit: TimeUnit;
}

const multipliers: Record<TimeUnit, number> = {
  milliseconds: 1,
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

export function toMilliseconds(timeSpan: TimeSpan): number {
  return timeSpan.value * multipliers[timeSpan.unit];
}
