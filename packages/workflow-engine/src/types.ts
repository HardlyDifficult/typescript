/**
 * Allowed transitions per status.
 * Each key is a status, its value is the list of statuses it can transition to.
 * Statuses with empty arrays are terminal (no outgoing transitions).
 */
export type TransitionMap<TStatus extends string> = Record<
  TStatus,
  readonly TStatus[]
>;

/**
 * Callback that receives a mutable draft of the data.
 * Mutations are applied if the function returns without throwing.
 */
export type DataUpdater<TData> = (draft: TData) => void;

/**
 * Event emitted on transitions, updates, and loads.
 */
export interface TransitionEvent<TStatus extends string, TData> {
  type: "transition" | "update" | "load";
  from?: TStatus;
  to?: TStatus;
  status: TStatus;
  data: Readonly<TData>;
  timestamp: string;
}

/**
 * Configuration for WorkflowEngine.
 */
export interface WorkflowEngineOptions<TStatus extends string, TData> {
  /** Unique key for StateTracker persistence */
  key: string;
  /** Initial status when creating a new workflow */
  initialStatus: TStatus;
  /** Initial data when creating a new workflow */
  initialData: TData;
  /** Map of allowed transitions: status -> allowed next statuses */
  transitions: TransitionMap<TStatus>;
  /** Directory for state persistence */
  stateDirectory?: string;
  /** Auto-save interval in ms (default 5000) */
  autoSaveMs?: number;
  /** Called on transitions, updates, and loads */
  onTransition?: (event: TransitionEvent<TStatus, TData>) => void;
}

/**
 * Internal persisted shape: status + data + updatedAt together.
 */
export interface PersistedState<TStatus extends string, TData> {
  status: TStatus;
  data: TData;
  updatedAt: string;
}
