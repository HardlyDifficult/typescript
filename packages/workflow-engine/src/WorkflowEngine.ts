import { StateTracker } from "@hardlydifficult/state-tracker";

import type {
  DataUpdater,
  PersistedState,
  TransitionEvent,
  TransitionMap,
  WorkflowEngineOptions,
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
  private loaded = false;

  constructor(options: WorkflowEngineOptions<TStatus, TData>) {
    const { transitions, initialStatus } = options;

    if (!(initialStatus in transitions)) {
      throw new Error(
        `initialStatus "${initialStatus}" is not a key in the transitions map`
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
      throw new Error(`Cannot transition from terminal status "${from}"`);
    }

    const allowed = this.transitions[from];
    if (!allowed.includes(to)) {
      throw new Error(
        `Cannot transition from "${from}" to "${to}". ` +
          `Allowed: [${allowed.join(", ")}]`
      );
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
    this.onTransitionCb?.({
      type,
      from,
      to,
      status: this.status,
      data: this.data,
      timestamp: new Date().toISOString(),
    });
  }
}
