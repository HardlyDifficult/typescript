/**
 * Step execution functions for Pipeline.
 *
 * Extracted from Pipeline to keep each module focused:
 *   - runStep: retry loop, recovery, error handling
 *   - enterGate: gate transitions, optional pre-execute
 *   - fireHook: lifecycle hook dispatch with error swallowing
 */

import type { Logger } from "@hardlydifficult/logger";

import type {
  PipelineData,
  PipelineHooks,
  StepContext,
  StepDefinition,
} from "./pipelineTypes.js";
import type { WorkflowEngine } from "./WorkflowEngine.js";

/**
 * Dependencies passed from Pipeline to step execution functions.
 */
export interface StepRunnerDeps<TData extends Record<string, unknown>> {
  engine: WorkflowEngine<string, PipelineData<TData>>;
  stepDefs: readonly StepDefinition<TData>[];
  hooks: PipelineHooks<TData>;
  logger: Logger;
  signal: AbortSignal;
}

/** Build a StepContext for a step's execute function. */
function createStepContext<TData extends Record<string, unknown>>(
  deps: StepRunnerDeps<TData>
): StepContext<TData> {
  return {
    data: deps.engine.data.output,
    signal: deps.signal,
  };
}

/** Pipeline key for log context (uses first step name as identifier). */
function pipelineKey<TData extends Record<string, unknown>>(
  deps: StepRunnerDeps<TData>
): string | undefined {
  return deps.engine.data.steps[0]?.name;
}

/** Fire a lifecycle hook, swallowing any errors. */
export function fireHook<
  TData extends Record<string, unknown>,
  K extends keyof PipelineHooks<TData>,
>(
  hooks: PipelineHooks<TData>,
  name: K,
  ...args: Parameters<NonNullable<PipelineHooks<TData>[K]>>
): void {
  const fn = hooks[name];
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

/**
 * Enter a gate step: transition to gate status, run optional execute, fire hooks.
 * On execute failure, transitions pipeline to "failed".
 */
export async function enterGate<TData extends Record<string, unknown>>(
  deps: StepRunnerDeps<TData>,
  index: number
): Promise<void> {
  const stepDef = deps.stepDefs[index];

  // Transition to gate status
  const gateStatus = `gate:${stepDef.name}`;
  if (deps.engine.status !== gateStatus) {
    await deps.engine.transition(gateStatus, (d) => {
      d.currentStepIndex = index;
      d.steps[index].status = "gate_waiting";
      d.steps[index].startedAt = new Date().toISOString();
    });
  }

  // Run optional execute before pausing
  if (stepDef.execute) {
    try {
      const ctx = createStepContext(deps);
      const result = await stepDef.execute(ctx);
      await deps.engine.update((d) => {
        Object.assign(d.output, result);
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      deps.logger.error("Pipeline gate execute failed", {
        pipeline: pipelineKey(deps),
        step: stepDef.name,
        error: error.message,
      });
      await deps.engine.update((d) => {
        d.steps[index].status = "failed";
        d.steps[index].completedAt = new Date().toISOString();
        d.steps[index].error = error.message;
      });
      await deps.engine.transition("failed");
      fireHook(
        deps.hooks,
        "onStepFailed",
        stepDef.name,
        error.message,
        deps.engine.data.output
      );
      fireHook(
        deps.hooks,
        "onFailed",
        stepDef.name,
        error.message,
        deps.engine.data.output
      );
      return;
    }
  }

  deps.logger.info("Pipeline gate reached", {
    pipeline: pipelineKey(deps),
    step: stepDef.name,
  });
  fireHook(deps.hooks, "onGateReached", stepDef.name, deps.engine.data.output);
}

/**
 * Execute a single step with retry logic.
 * Returns true on success, false on failure (pipeline transitions to "failed").
 */
export async function runStep<TData extends Record<string, unknown>>(
  deps: StepRunnerDeps<TData>,
  index: number
): Promise<boolean> {
  const stepDef = deps.stepDefs[index];
  const maxAttempts = (stepDef.retries ?? 0) + 1;

  if (!stepDef.execute) {
    throw new Error(
      `Step "${stepDef.name}" has no execute function and is not a gate`
    );
  }

  // Transition to running status
  const runningStatus = `running:${stepDef.name}`;
  if (deps.engine.status !== runningStatus) {
    await deps.engine.transition(runningStatus, (d) => {
      d.currentStepIndex = index;
      d.steps[index].status = "running";
      d.steps[index].startedAt = new Date().toISOString();
    });
  } else {
    // Crash recovery — already in running status, just update step state
    await deps.engine.update((d) => {
      d.steps[index].status = "running";
      d.steps[index].startedAt ??= new Date().toISOString();
    });
  }

  deps.logger.info("Pipeline step started", {
    pipeline: pipelineKey(deps),
    step: stepDef.name,
  });
  fireHook(deps.hooks, "onStepStart", stepDef.name, deps.engine.data.output);

  const startMs = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ctx = createStepContext(deps);
      const result = await stepDef.execute(ctx);
      const durationMs = Date.now() - startMs;

      // Success — merge result and mark completed
      await deps.engine.update((d) => {
        Object.assign(d.output, result);
        d.steps[index].status = "completed";
        d.steps[index].completedAt = new Date().toISOString();
        d.steps[index].attempts = attempt;
        d.steps[index].error = undefined;
        d.currentStepIndex = index + 1;
      });

      deps.logger.info("Pipeline step completed", {
        pipeline: pipelineKey(deps),
        step: stepDef.name,
        attempt,
        durationMs,
      });
      fireHook(
        deps.hooks,
        "onStepComplete",
        stepDef.name,
        deps.engine.data.output
      );

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      await deps.engine.update((d) => {
        d.steps[index].attempts = attempt;
        d.steps[index].error = error.message;
      });

      if (attempt < maxAttempts) {
        deps.logger.warn("Pipeline step retry", {
          pipeline: pipelineKey(deps),
          step: stepDef.name,
          attempt,
          maxAttempts,
          error: error.message,
        });

        // Recovery before retry
        if (stepDef.recover) {
          try {
            const ctx = createStepContext(deps);
            const recoveryResult = await stepDef.recover(error, ctx);
            await deps.engine.update((d) => {
              Object.assign(d.output, recoveryResult);
            });
          } catch (recoverErr) {
            const recoverError =
              recoverErr instanceof Error
                ? recoverErr
                : new Error(String(recoverErr));
            deps.logger.error("Pipeline recovery failed", {
              pipeline: pipelineKey(deps),
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
      await deps.engine.update((d) => {
        d.steps[index].status = "failed";
        d.steps[index].completedAt = new Date().toISOString();
      });

      deps.logger.error("Pipeline step failed", {
        pipeline: pipelineKey(deps),
        step: stepDef.name,
        attempt,
        durationMs,
        error: error.message,
      });
      fireHook(
        deps.hooks,
        "onStepFailed",
        stepDef.name,
        error.message,
        deps.engine.data.output
      );

      await deps.engine.transition("failed");
      fireHook(
        deps.hooks,
        "onFailed",
        stepDef.name,
        error.message,
        deps.engine.data.output
      );

      return false;
    }
  }

  return false; // unreachable, but satisfies TS
}
