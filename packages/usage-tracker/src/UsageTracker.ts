import { StateTracker } from "@hardlydifficult/state-tracker";

import { extractCostFromDelta, findCostFieldPaths } from "./costFields.js";
import { deepAdd } from "./deepAdd.js";
import { SpendLimitExceededError } from "./SpendLimitExceededError.js";
import type {
  DeepPartial,
  NumericRecord,
  PersistedUsageState,
  SpendLimit,
  SpendStatus,
  UsageTrackerOptions,
} from "./types.js";

/**
 * Accumulates numeric metrics over time with automatic session vs. cumulative
 * dual-tracking, backed by persistent storage via StateTracker.
 *
 * Cost-aware by convention: any leaf field ending with "CostUsd" in your
 * default metrics is automatically tracked in a time-series. This enables
 * trailing-window spend queries and optional spend limits.
 *
 * Type is inferred from the `default` value — no explicit interface needed.
 * Use the static `create()` factory to construct and load in one step.
 */
export class UsageTracker<T extends NumericRecord> {
  private readonly tracker: StateTracker<PersistedUsageState<T>>;
  private readonly defaultMetrics: T;
  private readonly costFieldPaths: string[];
  private readonly spendLimits: readonly SpendLimit[];
  private readonly onSpendLimitExceeded?: (status: SpendStatus) => void;
  private readonly maxWindowMs: number;

  private constructor(
    options: UsageTrackerOptions<T>,
    tracker: StateTracker<PersistedUsageState<T>>
  ) {
    this.defaultMetrics = structuredClone(options.default);
    this.tracker = tracker;
    this.costFieldPaths = findCostFieldPaths(options.default);
    this.spendLimits = options.spendLimits ?? [];
    this.onSpendLimitExceeded = options.onSpendLimitExceeded;
    this.maxWindowMs =
      this.spendLimits.length > 0
        ? Math.max(...this.spendLimits.map((l) => l.windowMs))
        : 0;
  }

  /** Create a UsageTracker, load persisted state, and start a new session. */
  static async create<T extends NumericRecord>(
    options: UsageTrackerOptions<T>
  ): Promise<UsageTracker<T>> {
    const now = new Date().toISOString();
    const tracker = new StateTracker<PersistedUsageState<T>>({
      key: options.key,
      default: {
        cumulative: structuredClone(options.default),
        session: structuredClone(options.default),
        trackingSince: now,
        sessionStartedAt: now,
        spendEntries: [],
      },
      stateDirectory: options.stateDirectory,
      autoSaveMs: options.autoSaveMs,
      onEvent: options.onEvent,
    });

    await tracker.loadAsync();

    // Backfill spendEntries for state files created before this feature
    if (!Array.isArray(tracker.state.spendEntries)) {
      tracker.update({ spendEntries: [] } as Partial<PersistedUsageState<T>>);
    }

    const instance = new UsageTracker(options, tracker);

    // Reset session counters for the new session, preserving cumulative
    tracker.update({
      session: structuredClone(options.default),
      sessionStartedAt: new Date().toISOString(),
    } as Partial<PersistedUsageState<T>>);

    // Prune stale entries from a prior session
    instance.pruneEntries();

    return instance;
  }

  /** Current session metrics (since last create() call). */
  get session(): Readonly<T> {
    return this.tracker.state.session;
  }

  /** All-time cumulative metrics. */
  get cumulative(): Readonly<T> {
    return this.tracker.state.cumulative;
  }

  /** ISO string of when the current session started. */
  get sessionStartedAt(): string {
    return this.tracker.state.sessionStartedAt;
  }

  /** ISO string of when cumulative tracking first started. */
  get trackingSince(): string {
    return this.tracker.state.trackingSince;
  }

  /** Whether state is being persisted to disk. */
  get isPersistent(): boolean {
    return this.tracker.isPersistent;
  }

  /**
   * Record metrics by deeply adding numeric values to both session and cumulative.
   * Only provide the fields you are incrementing — unspecified fields are unchanged.
   *
   * If the delta contains *CostUsd fields, a timestamped entry is appended to the
   * internal cost time-series. Configured spend limits are checked automatically.
   */
  record(values: DeepPartial<T>): void {
    const { state } = this.tracker;
    const newSession = structuredClone(state.session);
    const newCumulative = structuredClone(state.cumulative);

    deepAdd(newSession, values);
    deepAdd(newCumulative, values);

    const update: Partial<PersistedUsageState<T>> = {
      session: newSession,
      cumulative: newCumulative,
    };

    // Track cost in time-series if any CostUsd fields are present
    if (this.costFieldPaths.length > 0) {
      const cost = extractCostFromDelta(values, this.costFieldPaths);
      if (cost > 0) {
        const entries = [
          ...state.spendEntries,
          { timestamp: Date.now(), amountUsd: cost },
        ];
        update.spendEntries = entries;
      }
    }

    this.tracker.update(update);

    // Prune and check limits after updating state
    if (update.spendEntries !== undefined) {
      this.pruneEntries();
      this.checkLimits();
    }
  }

  /**
   * Total cost (USD) recorded within a trailing window.
   *
   * Works for any window size — not limited to configured spend limits.
   * Useful for dashboard spend-rate displays.
   */
  costInWindow(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    let total = 0;
    for (const entry of this.tracker.state.spendEntries) {
      if (entry.timestamp >= cutoff) {
        total += entry.amountUsd;
      }
    }
    return total;
  }

  /**
   * Get status of all configured spend limits.
   * Returns an empty array if no spend limits are configured.
   */
  spendStatus(): SpendStatus[] {
    return this.spendLimits.map((limit) => this.statusForLimit(limit));
  }

  /**
   * Throws SpendLimitExceededError if any configured limit is currently exceeded.
   * No-op if no spend limits are configured.
   */
  assertWithinSpendLimits(): void {
    for (const limit of this.spendLimits) {
      const status = this.statusForLimit(limit);
      if (status.exceeded) {
        throw new SpendLimitExceededError(status);
      }
    }
  }

  /** Force-save current state to disk immediately. */
  async save(): Promise<void> {
    await this.tracker.saveAsync();
  }

  private statusForLimit(limit: SpendLimit): SpendStatus {
    const now = Date.now();
    const cutoff = now - limit.windowMs;
    const entries = this.tracker.state.spendEntries;

    let spentUsd = 0;
    for (const entry of entries) {
      if (entry.timestamp >= cutoff) {
        spentUsd += entry.amountUsd;
      }
    }

    const exceeded = spentUsd > limit.maxSpendUsd;
    let resumesAt: Date | null = null;

    if (exceeded) {
      // Find when enough old entries will drop out of the window to get back under the limit.
      // Walk entries from oldest to newest, accumulating the "excess" to shed.
      const excess = spentUsd - limit.maxSpendUsd;
      let shed = 0;
      for (const entry of entries) {
        if (entry.timestamp < cutoff) {
          continue;
        }
        shed += entry.amountUsd;
        if (shed >= excess) {
          // This entry leaving the window brings us under the limit
          resumesAt = new Date(entry.timestamp + limit.windowMs);
          break;
        }
      }
    }

    return {
      limit,
      spentUsd,
      remainingUsd: Math.max(0, limit.maxSpendUsd - spentUsd),
      exceeded,
      resumesAt,
    };
  }

  /** Remove entries older than the longest configured window. */
  private pruneEntries(): void {
    if (this.maxWindowMs <= 0) {
      return;
    }
    const cutoff = Date.now() - this.maxWindowMs;
    const entries = this.tracker.state.spendEntries;
    const pruned = entries.filter((e) => e.timestamp >= cutoff);
    if (pruned.length < entries.length) {
      this.tracker.update({ spendEntries: pruned } as Partial<
        PersistedUsageState<T>
      >);
    }
  }

  /** Fire onSpendLimitExceeded for any newly-exceeded limit. */
  private checkLimits(): void {
    if (this.onSpendLimitExceeded === undefined) {
      return;
    }
    for (const limit of this.spendLimits) {
      const status = this.statusForLimit(limit);
      if (status.exceeded) {
        this.onSpendLimitExceeded(status);
      }
    }
  }
}
