import type { Logger } from "@hardlydifficult/logger";

import type {
  PipelineData,
  PipelineHooks,
  PipelineOptions,
  PipelineSnapshot,
  StepContext,
  StepDefinition,
  StepState,
} from "./pipelineTypes.js";
import type { TransitionMap } from "./types.js";
import { WorkflowEngine } from "./WorkflowEngine.js";

/**
 * A linear sequence of steps with automatic state management, persistence,
 * and lifecycle logging.
 *
 * Wraps WorkflowEngine internally. Steps execute sequentially, each receiving
 * accumulated data from prior steps. Gate steps pause until resume() is called.
 * Retryable steps call an optional recovery function between attempts.
 *
 * Step execute functions should be idempotent — on crash recovery the
 * interrupted step is re-executed.
 */
export class Pipeline<TData extends Record<string, unknown>> {
  private readonly engine: WorkflowEngine<string, PipelineData<TData>>;
  private readonly stepDefs: readonly StepDefinition<TData>[];
  private readonly hooks: PipelineHooks<TData>;
  private readonly logger: Logger;
  private abortController: AbortController;
  private gateResolver: (() => void) | null = null;
  private gatePromise: Promise<void> | null = null;

  constructor(options: PipelineOptions<TData>) {
    const { steps, initialData, logger, hooks } = options;

    if (steps.length === 0) {
      throw new Error("Pipeline requires at least one step");
    }

    const names = new Set<string>();
    for (const step of steps) {
      if (names.has(step.name)) {
        throw new Error(`Duplicate step name: "${step.name}"`);
      }
      names.add(step.name);
    }

    this.stepDefs = steps;
    this.hooks = hooks ?? {};
    this.logger = logger;

    // Wire external signal to internal abort controller
    this.abortController = new AbortController();
    if (options.signal) {
      const externalSignal = options.signal;
      if (externalSignal.aborted) {
        this.abortController.abort();
      } else {
        externalSignal.addEventListener("abort", () => {
          this.abortController.abort();
        });
      }
    }

    const transitions = Pipeline.buildTransitions(steps);
    const initialStatus =
      steps[0].gate === true
        ? `gate:${steps[0].name}`
        : `running:${steps[0].name}`;

    logger.debug("Pipeline created", {
      pipeline: options.key,
      steps: steps.map((s) => s.name),
      initialStatus,
    });

    this.engine = new WorkflowEngine<string, PipelineData<TData>>({
      key: options.key,
      initialStatus,
      initialData: {
        currentStepIndex: 0,
        steps: steps.map((s) => ({
          name: s.name,
          status: "pending" as const,
          attempts: 0,
        })),
        output: initialData,
        createdAt: new Date().toISOString(),
      },
      transitions,
      stateDirectory: options.stateDirectory,
      autoSaveMs: options.autoSaveMs,
    });
  }

  // ── Read-Only Accessors ──────────────────────────────────────────

  /** Current pipeline status string (e.g. "running:step_name", "gate:step_name", "completed") */
  get status(): string {
    return this.engine.status;
  }

  /** Accumulated output data (read-only) */
  get data(): Readonly<TData> {
    return this.engine.data.output;
  }

  /** Per-step runtime states */
  get steps(): readonly StepState[] {
    return this.engine.data.steps;
  }

  /** Name of the currently executing or waiting step, or undefined if terminal */
  get currentStep(): string | undefined {
    if (this.engine.isTerminal) {
      return undefined;
    }
    return this.stepDefs[this.engine.data.currentStepIndex]?.name;
  }

  /** Whether the pipeline has reached a terminal state */
  get isTerminal(): boolean {
    return this.engine.isTerminal;
  }

  /** Whether the pipeline is paused at a gate */
  get isWaitingAtGate(): boolean {
    return this.engine.status.startsWith("gate:");
  }

  // ── Lifecycle Methods ────────────────────────────────────────────

  /**
   * Load persisted state and execute.
   *
   * - Fresh pipeline: executes from step 0
   * - Interrupted mid-step: re-executes that step
   * - Waiting at gate: stays at gate (call resume() to continue)
   * - Terminal: no-op
   */
  async run(): Promise<void> {
    await this.engine.load();

    if (this.engine.isTerminal) {
      return;
    }

    if (this.isWaitingAtGate) {
      // Check if this is a fresh gate (not yet entered)
      const currentIndex = this.engine.data.currentStepIndex;
      const stepState = this.engine.data.steps[currentIndex];
      if (stepState.status === "pending") {
        // Fresh gate — enter it (run execute if present, fire hooks)
        await this.enterGate(currentIndex);
      }
      return;
    }

    await this.executeFrom(this.engine.data.currentStepIndex);
  }

  /**
   * Resume from a gate step. Merges the provided partial data and
   * continues execution from the next step.
   *
   * @throws If the pipeline is not currently at a gate
   */
  async resume(data?: Partial<TData>): Promise<void> {
    if (!this.isWaitingAtGate) {
      throw new Error(
        `Cannot resume: pipeline is not at a gate (status: "${this.status}")`
      );
    }

    const index = this.engine.data.currentStepIndex;
    const stepDef = this.stepDefs[index];

    this.logger.info("Pipeline gate resumed", {
      pipeline: this.engine.data.steps[0]?.name,
      step: stepDef.name,
      hasData: data !== undefined,
    });

    // Merge data and mark gate step completed
    await this.engine.update((d) => {
      if (data) {
        Object.assign(d.output, data);
      }
      d.steps[index].status = "completed";
      d.steps[index].completedAt = new Date().toISOString();
      d.currentStepIndex = index + 1;
    });

    // Transition to next step's status
    const nextStatus = this.statusForStep(index + 1);
    await this.engine.transition(nextStatus);

    // Resolve any waiting gate promise (for in-process resumption)
    const resolver = this.gateResolver;
    this.gateResolver = null;
    this.gatePromise = null;
    resolver?.();

    // Continue execution if not completed
    if (nextStatus !== "completed") {
      await this.executeFrom(index + 1);
    } else {
      this.logger.info("Pipeline completed", {
        pipeline: this.engine.data.steps[0]?.name,
      });
      this.fireHook("onComplete", this.data);
    }
  }

  /**
   * Cancel the pipeline. Transitions to "cancelled" status.
   */
  async cancel(): Promise<void> {
    if (this.engine.isTerminal) {
      return;
    }

    this.abortController.abort();

    await this.engine.transition("cancelled");
    this.logger.info("Pipeline cancelled", {
      pipeline: this.engine.data.steps[0]?.name,
      step: this.currentStep,
    });

    // Resolve any waiting gate promise to unblock
    const resolver = this.gateResolver;
    this.gateResolver = null;
    this.gatePromise = null;
    resolver?.();
  }

  /**
   * Subscribe to engine change events. Returns an unsubscribe function.
   */
  on(
    listener: (event: { status: string; data: Readonly<TData> }) => void
  ): () => void {
    return this.engine.on((event) => {
      listener({ status: event.status, data: event.data.output });
    });
  }

  /**
   * Return a read-only snapshot of the pipeline state.
   */
  toSnapshot(): PipelineSnapshot<TData> {
    return {
      status: this.status,
      data: structuredClone(this.data) as TData,
      steps: structuredClone(this.engine.data.steps) as readonly StepState[],
      isTerminal: this.isTerminal,
    };
  }

  // ── Private: Execution Loop ──────────────────────────────────────

  private async executeFrom(startIndex: number): Promise<void> {
    for (let i = startIndex; i < this.stepDefs.length; i++) {
      // Check cancellation between steps
      if (this.abortController.signal.aborted) {
        if (!this.engine.isTerminal) {
          await this.engine.transition("cancelled");
        }
        return;
      }

      const stepDef = this.stepDefs[i];

      // Gate step
      if (stepDef.gate === true) {
        await this.enterGate(i);
        return; // Execution pauses here — resume() continues
      }

      // Regular or retryable step
      const succeeded = await this.runStep(i);
      if (!succeeded) {
        return;
      } // Failed — pipeline is in "failed" state
    }

    // All steps complete
    await this.engine.transition("completed");
    this.logger.info("Pipeline completed", {
      pipeline: this.engine.data.steps[0]?.name,
    });
    this.fireHook("onComplete", this.data);
  }

  private async enterGate(index: number): Promise<void> {
    const stepDef = this.stepDefs[index];

    // Transition to gate status
    const gateStatus = `gate:${stepDef.name}`;
    if (this.engine.status !== gateStatus) {
      await this.engine.transition(gateStatus, (d) => {
        d.currentStepIndex = index;
        d.steps[index].status = "gate_waiting";
        d.steps[index].startedAt = new Date().toISOString();
      });
    }

    // Run optional execute before pausing
    if (stepDef.execute) {
      try {
        const ctx = this.createContext();
        const result = await stepDef.execute(ctx);
        await this.engine.update((d) => {
          Object.assign(d.output, result);
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.error("Pipeline gate execute failed", {
          pipeline: this.engine.data.steps[0]?.name,
          step: stepDef.name,
          error: error.message,
        });
        // Gate execute failure → pipeline fails
        await this.engine.update((d) => {
          d.steps[index].status = "failed";
          d.steps[index].completedAt = new Date().toISOString();
          d.steps[index].error = error.message;
        });
        await this.engine.transition("failed");
        this.fireHook("onStepFailed", stepDef.name, error.message, this.data);
        this.fireHook("onFailed", stepDef.name, error.message, this.data);
        return;
      }
    }

    this.logger.info("Pipeline gate reached", {
      pipeline: this.engine.data.steps[0]?.name,
      step: stepDef.name,
    });
    this.fireHook("onGateReached", stepDef.name, this.data);
  }

  /** Run a step with retries. Returns true if succeeded, false if failed. */
  private async runStep(index: number): Promise<boolean> {
    const stepDef = this.stepDefs[index];
    const maxAttempts = (stepDef.retries ?? 0) + 1;

    if (!stepDef.execute) {
      throw new Error(
        `Step "${stepDef.name}" has no execute function and is not a gate`
      );
    }

    // Transition to running status
    const runningStatus = `running:${stepDef.name}`;
    if (this.engine.status !== runningStatus) {
      await this.engine.transition(runningStatus, (d) => {
        d.currentStepIndex = index;
        d.steps[index].status = "running";
        d.steps[index].startedAt = new Date().toISOString();
      });
    } else {
      // Crash recovery — already in running status, just update step state
      await this.engine.update((d) => {
        d.steps[index].status = "running";
        d.steps[index].startedAt ??= new Date().toISOString();
      });
    }

    this.logger.info("Pipeline step started", {
      pipeline: this.engine.data.steps[0]?.name,
      step: stepDef.name,
    });
    this.fireHook("onStepStart", stepDef.name, this.data);

    const startMs = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const ctx = this.createContext();
        const result = await stepDef.execute(ctx);

        const durationMs = Date.now() - startMs;

        // Success — merge result and mark completed
        await this.engine.update((d) => {
          Object.assign(d.output, result);
          d.steps[index].status = "completed";
          d.steps[index].completedAt = new Date().toISOString();
          d.steps[index].attempts = attempt;
          d.steps[index].error = undefined;
          d.currentStepIndex = index + 1;
        });

        this.logger.info("Pipeline step completed", {
          pipeline: this.engine.data.steps[0]?.name,
          step: stepDef.name,
          attempt,
          durationMs,
        });
        this.fireHook("onStepComplete", stepDef.name, this.data);

        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        await this.engine.update((d) => {
          d.steps[index].attempts = attempt;
          d.steps[index].error = error.message;
        });

        if (attempt < maxAttempts) {
          this.logger.warn("Pipeline step retry", {
            pipeline: this.engine.data.steps[0]?.name,
            step: stepDef.name,
            attempt,
            maxAttempts,
            error: error.message,
          });

          // Recovery before retry
          if (stepDef.recover) {
            try {
              const ctx = this.createContext();
              const recoveryResult = await stepDef.recover(error, ctx);
              await this.engine.update((d) => {
                Object.assign(d.output, recoveryResult);
              });
            } catch (recoverErr) {
              const recoverError =
                recoverErr instanceof Error
                  ? recoverErr
                  : new Error(String(recoverErr));
              this.logger.error("Pipeline recovery failed", {
                pipeline: this.engine.data.steps[0]?.name,
                step: stepDef.name,
                attempt,
                error: recoverError.message,
              });
              // Recovery failed — continue to next attempt anyway
            }
          }
          continue;
        }

        const durationMs = Date.now() - startMs;

        // All attempts exhausted — fail
        await this.engine.update((d) => {
          d.steps[index].status = "failed";
          d.steps[index].completedAt = new Date().toISOString();
        });

        this.logger.error("Pipeline step failed", {
          pipeline: this.engine.data.steps[0]?.name,
          step: stepDef.name,
          attempt,
          durationMs,
          error: error.message,
        });
        this.fireHook("onStepFailed", stepDef.name, error.message, this.data);

        await this.engine.transition("failed");
        this.fireHook("onFailed", stepDef.name, error.message, this.data);

        return false;
      }
    }

    return false; // unreachable, but satisfies TS
  }

  // ── Private: Helpers ─────────────────────────────────────────────

  private createContext(): StepContext<TData> {
    return {
      data: this.data,
      signal: this.abortController.signal,
    };
  }

  /** Get the status string for a step index, or "completed" if past the end */
  private statusForStep(index: number): string {
    if (index >= this.stepDefs.length) {
      return "completed";
    }
    const step = this.stepDefs[index];
    return step.gate === true ? `gate:${step.name}` : `running:${step.name}`;
  }

  /** Fire a hook, swallowing any errors */
  private fireHook<K extends keyof PipelineHooks<TData>>(
    name: K,
    ...args: Parameters<NonNullable<PipelineHooks<TData>[K]>>
  ): void {
    const fn = this.hooks[name];
    if (!fn) {
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic hook dispatch
      (fn as (...a: any[]) => void)(...args);
    } catch {
      // Hooks must not break pipeline execution
    }
  }

  /** Compute the status string for the step after index i, or "completed" if last */
  private static nextStatusForStep<T>(
    steps: readonly StepDefinition<T>[],
    i: number
  ): string {
    if (i >= steps.length - 1) {
      return "completed";
    }
    const next = steps[i + 1];
    return next.gate === true ? `gate:${next.name}` : `running:${next.name}`;
  }

  /** Build a TransitionMap from step definitions */
  private static buildTransitions<T>(
    steps: readonly StepDefinition<T>[]
  ): TransitionMap<string> {
    const map: Record<string, readonly string[]> = {};

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isGate = step.gate === true;
      const nextStatus = this.nextStatusForStep(steps, i);

      if (isGate) {
        const gateStatus = `gate:${step.name}`;
        map[gateStatus] = [nextStatus, "failed", "cancelled"];
      } else {
        const runningStatus = `running:${step.name}`;
        map[runningStatus] = [nextStatus, "failed", "cancelled"];
      }
    }

    // Terminal states
    map.completed = [];
    map.failed = [];
    map.cancelled = [];

    return map as TransitionMap<string>;
  }
}
