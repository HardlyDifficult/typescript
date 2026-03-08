import type {
  StateTrackerEvent,
  StorageAdapter,
} from "@hardlydifficult/state-tracker";

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

/** Named trailing windows supported for spend queries and budgets. */
export type BudgetWindow = "minute" | "hour" | "day" | "week";

/** Opinionated spend budget config keyed by named time window. */
export type Budget = Partial<Record<BudgetWindow, number>>;

/** Status of a single budget window. */
export interface BudgetStatus {
  window: BudgetWindow;
  /** Amount spent in the current window. */
  spentUsd: number;
  /** Configured maximum spend allowed in the window. */
  limitUsd: number;
  /** How much more can be spent before hitting the limit. */
  remainingUsd: number;
  /** Whether the window is currently over budget. */
  exceeded: boolean;
  /** When the window will have enough room again (null if not exceeded). */
  resumesAt: Date | null;
}

/** Snapshot of all configured budgets. */
export type BudgetSnapshot = Partial<Record<BudgetWindow, BudgetStatus>>;

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

/** Configuration for UsageTracker.open(). */
export interface UsageTrackerOpenOptions {
  /** Directory for state persistence. */
  dir?: string;
  /** Custom storage adapter (takes priority over dir). */
  storage?: StorageAdapter;
  /** Auto-save interval in ms (passed through to StateTracker). */
  autoSaveMs?: number;
  /** Event callback for logging (same shape as StateTracker). */
  onEvent?: (event: StateTrackerEvent) => void;
  /** Spend budgets keyed by named time window. */
  budget?: Budget;
  /** Fires when a budget transitions from within-budget to exceeded after a track() call. */
  onBudgetExceeded?: (status: BudgetStatus) => void;
}
