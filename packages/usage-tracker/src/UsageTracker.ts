import { StateTracker } from "@hardlydifficult/state-tracker";

import { BudgetExceededError } from "./BudgetExceededError.js";
import { extractCostFromDelta, findCostFieldPaths } from "./costFields.js";
import { deepAdd } from "./deepAdd.js";
import type {
  BudgetSnapshot,
  BudgetStatus,
  BudgetWindow,
  DeepPartial,
  NumericRecord,
  PersistedUsageState,
  UsageTrackerOpenOptions,
} from "./types.js";

interface BudgetLimit {
  window: BudgetWindow;
  limitUsd: number;
  windowMs: number;
}

const WINDOW_MS: Record<BudgetWindow, number> = {
  minute: 60_000,
  hour: 60 * 60_000,
  day: 24 * 60 * 60_000,
  week: 7 * 24 * 60 * 60_000,
};

const WINDOW_ORDER: readonly BudgetWindow[] = [
  "minute",
  "hour",
  "day",
  "week",
];

const DEFAULT_RETENTION_WINDOW_MS = WINDOW_MS.week;

function normalizeBudget(options: UsageTrackerOpenOptions): readonly BudgetLimit[] {
  const budget = options.budget ?? {};
  return WINDOW_ORDER.flatMap((window) => {
    const limitUsd = budget[window];
    if (limitUsd === undefined) {
      return [];
    }
    if (!Number.isFinite(limitUsd) || limitUsd < 0) {
      throw new Error(`Budget for "${window}" must be a finite number >= 0`);
    }
    return [
      {
        window,
        limitUsd,
        windowMs: WINDOW_MS[window],
      },
    ];
  });
}

/**
 * Tracks numeric usage counters with persisted totals, per-run counters, and
 * automatic cost budgets based on any metric ending in "CostUsd".
 */
export class UsageTracker<T extends NumericRecord> {
  private readonly tracker: StateTracker<PersistedUsageState<T>>;
  private readonly costFieldPaths: string[];
  private readonly budgetLimits: readonly BudgetLimit[];
  private readonly onBudgetExceeded?: (status: BudgetStatus) => void;
  private readonly maxRetainedSpendWindowMs: number;
  private budgetExceededStates: boolean[];

  private constructor(
    metrics: T,
    options: UsageTrackerOpenOptions,
    tracker: StateTracker<PersistedUsageState<T>>
  ) {
    this.tracker = tracker;
    this.costFieldPaths = findCostFieldPaths(metrics);
    this.budgetLimits = normalizeBudget(options);
    this.onBudgetExceeded = options.onBudgetExceeded;
    this.maxRetainedSpendWindowMs =
      this.costFieldPaths.length > 0 ? DEFAULT_RETENTION_WINDOW_MS : 0;
    this.budgetExceededStates = this.budgetLimits.map((limit) =>
      this.statusForBudget(limit).exceeded
    );
  }

  /**
   * Recursively fills in missing keys in `target` from `defaults`.
   * Only adds fields that are absent or undefined and never overwrites values.
   */
  private static mergeDefaults<U extends NumericRecord>(
    target: U,
    defaults: U
  ): U {
    const result = { ...target } as Record<string, unknown>;
    for (const key of Object.keys(defaults)) {
      const targetValue = result[key];
      const defaultValue = (defaults as Record<string, unknown>)[key];
      if (targetValue === undefined) {
        result[key] = structuredClone(defaultValue);
        continue;
      }

      if (
        typeof targetValue === "object" &&
        targetValue !== null &&
        typeof defaultValue === "object" &&
        defaultValue !== null
      ) {
        result[key] = UsageTracker.mergeDefaults(
          targetValue as NumericRecord,
          defaultValue as NumericRecord
        );
      }
    }
    return result as U;
  }

  /** Open a tracker for `id`, load persisted totals, and start a fresh current run. */
  static async open<T extends NumericRecord>(
    id: string,
    metrics: T,
    options: UsageTrackerOpenOptions = {}
  ): Promise<UsageTracker<T>> {
    const now = new Date().toISOString();
    const tracker = new StateTracker<PersistedUsageState<T>>({
      key: id,
      default: {
        cumulative: structuredClone(metrics),
        session: structuredClone(metrics),
        trackingSince: now,
        sessionStartedAt: now,
        spendEntries: [],
      },
      stateDirectory: options.dir,
      storageAdapter: options.storage,
      autoSaveMs: options.autoSaveMs,
      onEvent: options.onEvent,
    });

    await tracker.loadAsync();

    if (!Array.isArray(tracker.state.spendEntries)) {
      tracker.update({ spendEntries: [] } as Partial<PersistedUsageState<T>>);
    }

    tracker.update({
      cumulative: UsageTracker.mergeDefaults(tracker.state.cumulative, metrics),
    } as Partial<PersistedUsageState<T>>);

    const instance = new UsageTracker(metrics, options, tracker);

    tracker.update({
      session: structuredClone(metrics),
      sessionStartedAt: new Date().toISOString(),
    } as Partial<PersistedUsageState<T>>);

    instance.pruneSpendEntries();
    instance.syncBudgetExceededStates();

    return instance;
  }

  /** Metrics recorded since this tracker instance was opened. */
  get current(): Readonly<T> {
    return this.tracker.state.session;
  }

  /** All-time metrics across every run that used the same id. */
  get total(): Readonly<T> {
    return this.tracker.state.cumulative;
  }

  /** ISO timestamp for the current run. */
  get startedAt(): string {
    return this.tracker.state.sessionStartedAt;
  }

  /** ISO timestamp for when tracking for this id first began. */
  get trackingSince(): string {
    return this.tracker.state.trackingSince;
  }

  /** Whether usage data is being persisted successfully. */
  get persistent(): boolean {
    return this.tracker.isPersistent;
  }

  /** Status for every configured budget keyed by window name. */
  get budget(): BudgetSnapshot {
    const snapshot: BudgetSnapshot = {};
    for (const limit of this.budgetLimits) {
      snapshot[limit.window] = this.statusForBudget(limit);
    }
    return snapshot;
  }

  /**
   * Add numeric deltas into both the current run and the persisted total.
   * Any `*CostUsd` delta is also recorded for spend queries and budget checks.
   */
  track(values: DeepPartial<T>): void {
    const state = this.tracker.state;
    const current = structuredClone(state.session);
    const total = structuredClone(state.cumulative);

    deepAdd(current, values);
    deepAdd(total, values);

    const update: Partial<PersistedUsageState<T>> = {
      session: current,
      cumulative: total,
    };

    if (this.costFieldPaths.length > 0) {
      const cost = extractCostFromDelta(values, this.costFieldPaths);
      if (cost > 0) {
        update.spendEntries = [
          ...state.spendEntries,
          { timestamp: Date.now(), amountUsd: cost },
        ];
      }
    }

    this.tracker.update(update);

    if (update.spendEntries !== undefined) {
      this.pruneSpendEntries();
      this.checkBudget();
    }
  }

  /** Spend recorded in the last supported named window. */
  spend(window: BudgetWindow): number {
    const cutoff = Date.now() - WINDOW_MS[window];
    let total = 0;
    for (const entry of this.tracker.state.spendEntries) {
      if (entry.timestamp >= cutoff) {
        total += entry.amountUsd;
      }
    }
    return total;
  }

  /** Throws when any configured budget is currently exceeded. */
  assertBudget(): void {
    for (const limit of this.budgetLimits) {
      const status = this.statusForBudget(limit);
      if (status.exceeded) {
        throw new BudgetExceededError(status);
      }
    }
  }

  /** Force-save current state to disk immediately. */
  async save(): Promise<void> {
    await this.tracker.saveAsync();
  }

  private statusForBudget(limit: BudgetLimit): BudgetStatus {
    const now = Date.now();
    const cutoff = now - limit.windowMs;
    const entries = this.tracker.state.spendEntries;

    let spentUsd = 0;
    for (const entry of entries) {
      if (entry.timestamp >= cutoff) {
        spentUsd += entry.amountUsd;
      }
    }

    const exceeded = spentUsd > limit.limitUsd;
    let resumesAt: Date | null = null;

    if (exceeded) {
      const excess = spentUsd - limit.limitUsd;
      let shed = 0;
      for (const entry of entries) {
        if (entry.timestamp < cutoff) {
          continue;
        }
        shed += entry.amountUsd;
        if (shed >= excess) {
          resumesAt = new Date(entry.timestamp + limit.windowMs);
          break;
        }
      }
    }

    return {
      window: limit.window,
      spentUsd,
      limitUsd: limit.limitUsd,
      remainingUsd: Math.max(0, limit.limitUsd - spentUsd),
      exceeded,
      resumesAt,
    };
  }

  private pruneSpendEntries(): void {
    if (this.maxRetainedSpendWindowMs <= 0) {
      return;
    }
    const cutoff = Date.now() - this.maxRetainedSpendWindowMs;
    const entries = this.tracker.state.spendEntries;
    const pruned = entries.filter((entry) => entry.timestamp >= cutoff);
    if (pruned.length < entries.length) {
      this.tracker.update({ spendEntries: pruned } as Partial<
        PersistedUsageState<T>
      >);
    }
  }

  private checkBudget(): void {
    for (const [index, limit] of this.budgetLimits.entries()) {
      const status = this.statusForBudget(limit);
      const wasExceeded = this.budgetExceededStates[index] ?? false;
      this.budgetExceededStates[index] = status.exceeded;

      if (
        this.onBudgetExceeded !== undefined &&
        status.exceeded &&
        !wasExceeded
      ) {
        this.onBudgetExceeded(status);
      }
    }
  }

  private syncBudgetExceededStates(): void {
    this.budgetExceededStates = this.budgetLimits.map((limit) =>
      this.statusForBudget(limit).exceeded
    );
  }
}
