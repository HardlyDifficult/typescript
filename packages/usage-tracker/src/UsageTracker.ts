import { StateTracker } from "@hardlydifficult/state-tracker";

import { deepAdd } from "./deepAdd.js";
import type {
  DeepPartial,
  NumericRecord,
  PersistedUsageState,
  UsageTrackerOptions,
} from "./types.js";

/**
 * Accumulates numeric metrics over time with automatic session vs. cumulative
 * dual-tracking, backed by persistent storage via StateTracker.
 *
 * Type is inferred from the `default` value — no explicit interface needed.
 * Use the static `create()` factory to construct and load in one step.
 */
export class UsageTracker<T extends NumericRecord> {
  private readonly tracker: StateTracker<PersistedUsageState<T>>;
  private readonly defaultMetrics: T;

  private constructor(
    options: UsageTrackerOptions<T>,
    tracker: StateTracker<PersistedUsageState<T>>
  ) {
    this.defaultMetrics = structuredClone(options.default);
    this.tracker = tracker;
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
      },
      stateDirectory: options.stateDirectory,
      autoSaveMs: options.autoSaveMs,
      onEvent: options.onEvent,
    });

    await tracker.loadAsync();

    const instance = new UsageTracker(options, tracker);

    // Reset session counters for the new session, preserving cumulative
    tracker.update({
      session: structuredClone(options.default),
      sessionStartedAt: new Date().toISOString(),
    } as Partial<PersistedUsageState<T>>);

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
   */
  record(values: DeepPartial<T>): void {
    const { state } = this.tracker;
    const newSession = structuredClone(state.session);
    const newCumulative = structuredClone(state.cumulative);

    deepAdd(newSession, values);
    deepAdd(newCumulative, values);

    this.tracker.update({
      session: newSession,
      cumulative: newCumulative,
    } as Partial<PersistedUsageState<T>>);
  }

  /** Force-save current state to disk immediately. */
  async save(): Promise<void> {
    await this.tracker.saveAsync();
  }
}
