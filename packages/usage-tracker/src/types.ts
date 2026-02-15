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

/** Internal persisted state wrapping consumer metrics T. */
export interface PersistedUsageState<T extends NumericRecord> {
  cumulative: T;
  session: T;
  trackingSince: string;
  sessionStartedAt: string;
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
}
