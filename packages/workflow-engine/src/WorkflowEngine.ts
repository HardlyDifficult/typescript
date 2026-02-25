import { StateTracker } from "@hardlydifficult/state-tracker";

import { DataCursor } from "./DataCursor.js";
import {
  InvalidInitialStatusError,
  InvalidTransitionError,
  TerminalTransitionError,
} from "./errors.js";
import type {
  ChangeListener,
  DataUpdater,
  PersistedState,
  TransitionEvent,
  TransitionMap,
  WorkflowEngineOptions,
  WorkflowSnapshot,
} from "./types.js";

/**
 * General-purpose state machine with typed statuses, validated transitions,
 * and persistent state via StateTracker.
 */
export class WorkflowEngine<TStatus extends string, TData> {
  private readonly tracker: StateTracker<PersistedState<TStatus, TData>>;
  private readonly transitions: TransitionMap<TStatus>;
  private readonly onTransitionCb?: (
    event: TransitionEvent<TStatus, TData>
  ) => void;
  private readonly listeners = new Set<ChangeListener<TStatus, TData>>();
  private loaded = false;

  constructor(options: WorkflowEngineOptions<TStatus, TData>) {
    const { transitions, initialStatus } = options;

    if (!(initialStatus in transitions)) {
      throw new InvalidInitialStatusError(
        initialStatus,
        Object.keys(transitions)
      );
    }

    this.transitions = transitions;
    this.onTransitionCb = options.onTransition;

    this.tracker = new StateTracker<PersistedState<TStatus, TData>>({
      key: options.key,
      default: {
        status: initialStatus,
        data: options.initialData,
        updatedAt: new Date().toISOString(),
      },
      stateDirectory: options.stateDirectory,
      autoSaveMs: options.autoSaveMs ?? 5000,
    });
  }

  /** Current status */
  get status(): TStatus {
    return this.tracker.state.status;
  }

  /** Current data (read-only) */
  get data(): Readonly<TData> {
    return this.tracker.state.data;
  }

  /** Whether load() has been called */
  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Whether disk storage is available */
  get isPersistent(): boolean {
    return this.tracker.isPersistent;
  }

  /** ISO timestamp of the last transition or update */
  get updatedAt(): string {
    return this.tracker.state.updatedAt;
  }

  /** Whether the current status is terminal (no outgoing transitions) */
  get isTerminal(): boolean {
    return this.transitions[this.status].length === 0;
  }

  /**
   * Load persisted state from disk.
   * Uses defaults if no state file exists. Safe to call multiple times.
   */
  async load(): Promise<void> {
    await this.tracker.loadAsync();
    this.loaded = true;
    this.emitEvent("load");
  }

  /**
   * Transition to a new status, optionally mutating data.
   *
   * The updater receives a structuredClone of current data.
   * If the updater throws, the transition is aborted.
   * On success, state is persisted immediately.
   */
  async transition(to: TStatus, updater?: DataUpdater<TData>): Promise<void> {
    const from = this.status;

    if (this.isTerminal) {
      throw new TerminalTransitionError(from);
    }

    const allowed = this.transitions[from];
    if (!allowed.includes(to)) {
      throw new InvalidTransitionError(from, to, allowed);
    }

    const data = structuredClone(this.tracker.state.data);

    if (updater !== undefined) {
      updater(data);
    }

    this.tracker.set({
      status: to,
      data,
      updatedAt: new Date().toISOString(),
    });
    await this.tracker.saveAsync();

    this.emitEvent("transition", from, to);
  }

  /**
   * Update data without changing status.
   *
   * The updater receives a structuredClone of current data.
   * If the updater throws, no changes are applied.
   * On success, state is persisted immediately.
   */
  async update(updater: DataUpdater<TData>): Promise<void> {
    const data = structuredClone(this.tracker.state.data);

    updater(data);

    this.tracker.set({
      status: this.status,
      data,
      updatedAt: new Date().toISOString(),
    });
    await this.tracker.saveAsync();

    this.emitEvent("update");
  }

  /** Create a cursor for safe navigation into nested data. */
  cursor<TItem>(
    selector: (data: TData) => TItem | undefined
  ): DataCursor<TStatus, TData, TItem> {
    return new DataCursor(this, selector);
  }

  /**
   * Register a listener for all engine events (transition, update, load).
   * Returns an unsubscribe function.
   */
  on(listener: ChangeListener<TStatus, TData>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Return a read-only snapshot of the engine's current state. */
  toSnapshot(): WorkflowSnapshot<TStatus, TData> {
    return {
      status: this.status,
      data: structuredClone(this.data),
      updatedAt: this.updatedAt,
      isTerminal: this.isTerminal,
    };
  }

  /** Check if a specific transition is allowed from current status */
  canTransition(to: TStatus): boolean {
    return this.transitions[this.status].includes(to);
  }

  /** Get statuses reachable from current status */
  allowedTransitions(): readonly TStatus[] {
    return this.transitions[this.status];
  }

  /** Force-save current state to disk */
  async save(): Promise<void> {
    await this.tracker.saveAsync();
  }

  private emitEvent(
    type: "transition" | "update" | "load",
    from?: TStatus,
    to?: TStatus
  ): void {
    const event: TransitionEvent<TStatus, TData> = {
      type,
      from,
      to,
      status: this.status,
      data: this.data,
      timestamp: new Date().toISOString(),
    };

    const errors: unknown[] = [];
    if (this.onTransitionCb) {
      try {
        this.onTransitionCb(event);
      } catch (error) {
        errors.push(error);
      }
    }

    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "workflow event listener error");
    }
  }
}
