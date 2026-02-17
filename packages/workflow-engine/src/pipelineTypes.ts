import type { Logger } from "@hardlydifficult/logger";

/**
 * Step execution context passed to every step's execute function.
 */
export interface StepContext<TData> {
  /** Accumulated data from all prior steps (read-only) */
  readonly data: Readonly<TData>;
  /** Abort signal — steps should check this and bail early */
  readonly signal: AbortSignal;
}

/**
 * The execute function for a step.
 * Returns a partial data update to merge into accumulated data.
 */
export type StepExecutor<TData> = (
  ctx: StepContext<TData>
) => Promise<Partial<TData>>;

/**
 * Recovery function invoked when a retryable step fails.
 * Called between retries. Returns a partial data update
 * that is merged before the step re-executes.
 */
export type RecoveryFn<TData> = (
  error: Error,
  ctx: StepContext<TData>
) => Promise<Partial<TData>>;

/**
 * Step definition — one entry in the pipeline's step list.
 *
 * Three kinds:
 *   - Regular step: has `execute`, runs immediately
 *   - Gate step: has `gate: true`, pauses until `resume()` is called.
 *     May also have `execute` which runs before pausing.
 *   - Retryable step: has `execute` + `retries` (and optionally `recover`)
 */
export interface StepDefinition<TData> {
  /** Unique step name — becomes part of the pipeline status (e.g. "running:create_plan") */
  name: string;
  /** Execute function. For gate steps, runs before pausing. */
  execute?: StepExecutor<TData>;
  /** If true, pipeline pauses after execute until resume() is called */
  gate?: boolean;
  /** Number of retry attempts on failure (default 0 = no retries) */
  retries?: number;
  /** Recovery function called between retries. Only meaningful if retries > 0. */
  recover?: RecoveryFn<TData>;
}

/**
 * Runtime state of a single step, persisted inside PipelineData.
 */
export interface StepState {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "gate_waiting";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  attempts: number;
}

/**
 * Internal persisted data shape for Pipeline.
 * TData is the user's accumulated output data.
 */
export interface PipelineData<TData> {
  /** Index of the current step (0-based) */
  currentStepIndex: number;
  /** Per-step runtime state */
  steps: StepState[];
  /** Accumulated output data from completed steps */
  output: TData;
  /** ISO timestamp of pipeline creation */
  createdAt: string;
}

/**
 * Lifecycle hooks — all optional.
 * Hook errors are swallowed to avoid breaking pipeline execution.
 */
export interface PipelineHooks<TData> {
  onStepStart?: (name: string, data: Readonly<TData>) => void;
  onStepComplete?: (name: string, data: Readonly<TData>) => void;
  onStepFailed?: (name: string, error: string, data: Readonly<TData>) => void;
  onGateReached?: (name: string, data: Readonly<TData>) => void;
  onComplete?: (data: Readonly<TData>) => void;
  onFailed?: (name: string, error: string, data: Readonly<TData>) => void;
}

/**
 * Options for creating a Pipeline.
 */
export interface PipelineOptions<TData> {
  /** Unique key for persistence (passed to WorkflowEngine) */
  key: string;
  /** Ordered list of step definitions */
  steps: readonly StepDefinition<TData>[];
  /** Initial value for the accumulated output data */
  initialData: TData;
  /** Logger — all step lifecycle events are logged automatically */
  logger: Logger;
  /** Directory for state persistence */
  stateDirectory?: string;
  /** Auto-save interval in ms (default 5000) */
  autoSaveMs?: number;
  /** Lifecycle hooks for external integrations (Discord, dashboard, etc.) */
  hooks?: PipelineHooks<TData>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Read-only snapshot of the pipeline state.
 */
export interface PipelineSnapshot<TData> {
  status: string;
  data: Readonly<TData>;
  steps: readonly StepState[];
  isTerminal: boolean;
}
