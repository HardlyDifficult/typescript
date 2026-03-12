/**
 * Timezone-aware working hours utilities.
 * Determines if the current time falls within configured business hours.
 */

export interface WorkingHoursConfig {
  /** Start of working hours (0-23) */
  startHour: number;
  /** End of working hours (0-23, exclusive) */
  endHour: number;
  /** IANA timezone (e.g. 'America/New_York') */
  timezone: string;
}

/**
 * Check if the current time is within working hours in the given timezone.
 * Working hours are weekdays (Monday-Friday) between startHour and endHour.
 */
export function isWithinWorkingHours(config: WorkingHoursConfig): boolean {
  const { startHour, endHour, timezone } = config;

  const now = new Date();
  const timeInTimezone = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(now);

  const currentHour = parseInt(timeInTimezone, 10);

  const dayInTimezone = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(now);

  const isWeekend = dayInTimezone === 'Sat' || dayInTimezone === 'Sun';
  if (isWeekend) {
    return false;
  }

  return currentHour >= startHour && currentHour < endHour;
}

export interface WorkPatternConfig {
  /** Organization names to match (case-insensitive) */
  organizations: string[];
  /** Substrings to match in repo names (case-insensitive) */
  repoNameContains: string[];
}

/**
 * Check if a repository matches work patterns (organization or name).
 */
export function matchesWorkPattern(
  repoOwner: string,
  repoName: string,
  patterns: WorkPatternConfig
): boolean {
  const ownerLower = repoOwner.toLowerCase();
  const repoLower = repoName.toLowerCase();

  if (patterns.organizations.some((org) => ownerLower === org.toLowerCase())) {
    return true;
  }

  if (patterns.repoNameContains.some((pattern) => repoLower.includes(pattern.toLowerCase()))) {
    return true;
  }

  return false;
}
