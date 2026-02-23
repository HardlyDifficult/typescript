import type { Logger } from "@hardlydifficult/logger";

import { buildTransitions, statusForStep } from "./buildTransitions.js";
import {
  DuplicatePipelineStepNameError,
  PipelineHasNoStepsError,
  PipelineResumeError,
} from "./errors.js";
import type {
  PipelineData,
  PipelineHooks,
  PipelineOptions,
  PipelineSnapshot,
  StepDefinition,
  StepState,
} from "./pipelineTypes.js";
import {
  enterGate,
  fireHook,
  runStep,
  type StepRunnerDeps,
} from "./stepRunner.js";
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
      throw new PipelineHasNoStepsError();
    }

    const names = new Set<string>();
    for (const step of steps) {
      if (names.has(step.name)) {
        throw new DuplicatePipelineStepNameError(step.name);
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

    const transitions = buildTransitions(steps);
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
        await enterGate(this.runnerDeps, currentIndex);
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
      throw new PipelineResumeError(this.status);
    }

    const index = this.engine.data.currentStepIndex;
    const stepDef = this.stepDefs[index];

    this.logger.debug("Pipeline gate resumed", {
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
    const nextStatus = statusForStep(this.stepDefs, index + 1);
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
      fireHook(this.hooks, "onComplete", this.data);
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

  // ── Private ────────────────────────────────────────────────────────

  /** Assemble dependencies for step runner functions. */
  private get runnerDeps(): StepRunnerDeps<TData> {
    return {
      engine: this.engine,
      stepDefs: this.stepDefs,
      hooks: this.hooks,
      logger: this.logger,
      signal: this.abortController.signal,
    };
  }

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
        await enterGate(this.runnerDeps, i);
        return; // Execution pauses here — resume() continues
      }

      // Regular or retryable step
      const succeeded = await runStep(this.runnerDeps, i);
      if (!succeeded) {
        return;
      } // Failed — pipeline is in "failed" state
    }

    // All steps complete
    await this.engine.transition("completed");
    this.logger.info("Pipeline completed", {
      pipeline: this.engine.data.steps[0]?.name,
    });
    fireHook(this.hooks, "onComplete", this.data);
  }
}
