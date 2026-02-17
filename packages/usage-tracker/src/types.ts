import type { StateTrackerEvent } from "@hardlydifficult/state-tracker";

/** Constrains T to a nested object where every leaf is a number. */
export interface NumericRecord {
  [key: string]: number | NumericRecord;
}

/** Recursive partial — only provide the fields you are incrementing. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends number
    ? number
    : T[K] extends NumericRecord
      ? DeepPartial<T[K]>
      : never;
};

/** A trailing-window spend limit. */
export interface SpendLimit {
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum spend allowed in the window. */
  maxSpendUsd: number;
  /** Human-readable label, e.g. "24 hours". */
  label: string;
}

/** Status of a single spend limit window. */
export interface SpendStatus {
  limit: SpendLimit;
  /** Amount spent in the current window. */
  spentUsd: number;
  /** How much more can be spent before hitting the limit. */
  remainingUsd: number;
  /** Whether the limit is currently exceeded. */
  exceeded: boolean;
  /** When the window will have enough room again (null if not exceeded). */
  resumesAt: Date | null;
}

/** A single timestamped spend entry for the cost time-series. */
export interface SpendEntry {
  timestamp: number;
  amountUsd: number;
}

/** Internal persisted state wrapping consumer metrics T. */
export interface PersistedUsageState<T extends NumericRecord> {
  cumulative: T;
  session: T;
  trackingSince: string;
  sessionStartedAt: string;
  /** Cost time-series for spend-rate queries and throttle enforcement. */
  spendEntries: SpendEntry[];
}

/** Configuration for UsageTracker.create(). */
export interface UsageTrackerOptions<T extends NumericRecord> {
  /** Unique persistence key (alphanumeric, hyphens, underscores). */
  key: string;
  /** Default metrics shape — all leaves must be 0. */
  default: T;
  /** Directory for state persistence. */
  stateDirectory?: string;
  /** Auto-save interval in ms (passed through to StateTracker). */
  autoSaveMs?: number;
  /** Event callback for logging (same shape as StateTracker). */
  onEvent?: (event: StateTrackerEvent) => void;
  /** Trailing-window spend limits. Requires at least one *CostUsd field in `default`. */
  spendLimits?: readonly SpendLimit[];
  /** Fires when a spend limit is exceeded after a record() call. */
  onSpendLimitExceeded?: (status: SpendStatus) => void;
}
