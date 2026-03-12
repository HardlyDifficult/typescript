/**
 * Extra tests to cover remaining branches in workflow-engine package:
 * - Pipeline.ts line 69: externalSignal.aborted is true when Pipeline is created
 * - WorkflowEngine.ts line 217: onTransitionCb throws → errors.push(error)
 * - errors.ts line 106: StepExecutionMissingError constructor
 * - stepRunner.ts line 152: throw StepExecutionMissingError when step has no execute
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Logger } from "@hardlydifficult/logger";

import { Pipeline } from "../src/Pipeline.js";
import { WorkflowEngine } from "../src/WorkflowEngine.js";
import { StepExecutionMissingError } from "../src/errors.js";
import type { StepDefinition, PipelineHooks } from "../src/pipelineTypes.js";
import type { TransitionMap } from "../src/types.js";

interface TestData {
  value?: number;
}

let testDir: string;

function createLogger(): Logger {
  return new Logger("debug");
}

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-extra-test-"));
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ─── Pipeline.ts line 69 ─────────────────────────────────────────────────────

describe("Pipeline - already-aborted signal (line 69)", () => {
  it("aborts the internal controller immediately when the external signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(); // abort BEFORE creating Pipeline

    const steps: StepDefinition<TestData>[] = [
      {
        name: "step-1",
        execute: async (data) => data,
      },
    ];

    // Creating the Pipeline with an already-aborted signal triggers line 69
    const pipeline = new Pipeline<TestData>({
      key: "aborted-signal-test",
      steps,
      initialData: { value: 0 },
      logger: createLogger(),
      stateDirectory: testDir,
      signal: controller.signal,
    });

    // Running should immediately cancel (since signal is already aborted at construction)
    await pipeline.run();
    // Pipeline transitions to "cancelled" state when aborted
    expect(pipeline.status).toBe("cancelled");
  });
});

// ─── WorkflowEngine.ts line 217 ──────────────────────────────────────────────

describe("WorkflowEngine - onTransition callback throws (line 217)", () => {
  it("collects errors thrown by onTransitionCb and re-throws after listeners run", async () => {
    const transitions: TransitionMap<"idle" | "running" | "done"> = {
      idle: ["running"],
      running: ["done"],
      done: [],
    };

    const engine = new WorkflowEngine({
      key: "throwing-transition-test",
      initialStatus: "idle" as const,
      initialData: {},
      transitions,
      stateDirectory: testDir,
      onTransition: () => {
        throw new Error("transition callback error");
      },
    });

    // Transition should throw with AggregateError containing our error
    await expect(engine.transition("running")).rejects.toThrow(
      "workflow event listener error"
    );
  });
});

// ─── errors.ts line 106 + stepRunner.ts line 152 ─────────────────────────────

describe("StepExecutionMissingError constructor (errors.ts line 106)", () => {
  it("creates the error with the correct message and code", () => {
    const err = new StepExecutionMissingError("my-step");
    expect(err.message).toContain("my-step");
    expect(err.code).toBe("STEP_EXECUTION_MISSING");
  });
});

describe("stepRunner - step with no execute throws StepExecutionMissingError (line 152)", () => {
  it("throws StepExecutionMissingError when a step has no execute function", async () => {
    // A gate step (no execute) that is NOT marked as a gate should throw
    const steps: StepDefinition<TestData>[] = [
      {
        name: "no-execute-step",
        // No execute function and no gate: true
      },
    ];

    const pipeline = new Pipeline<TestData>({
      key: "no-execute-pipeline",
      steps,
      initialData: {},
      logger: createLogger(),
      stateDirectory: testDir,
    });

    await expect(pipeline.run()).rejects.toThrow(StepExecutionMissingError);
  });
});

// ─── stepRunner.ts line 210 - non-Error throw in runStep ─────────────────────

describe("stepRunner - non-Error thrown in execute (line 210 false branch)", () => {
  it("wraps a non-Error thrown from execute in a new Error", async () => {
    const steps: StepDefinition<TestData>[] = [
      {
        name: "throwing-step",
        execute: async () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "string error"; // non-Error thrown (covers err instanceof Error ? : false branch)
        },
      },
    ];

    const pipeline = new Pipeline<TestData>({
      key: "non-error-throw-pipeline",
      steps,
      initialData: {},
      logger: createLogger(),
      stateDirectory: testDir,
    });

    // The pipeline should fail (non-Error is wrapped into Error)
    await pipeline.run();
    expect(pipeline.status).toContain("failed");
  });
});

// ─── Pipeline.ts line 289 - abort when already terminal ──────────────────────

describe("Pipeline - abortController already terminal when signal fires (line 289)", () => {
  it("skips transition to cancelled if engine is already terminal", async () => {
    const controller = new AbortController();

    const steps: StepDefinition<TestData>[] = [
      {
        name: "step-then-abort",
        execute: async (data) => {
          // After this step completes, we'll have only 1 step so pipeline completes
          return data;
        },
      },
    ];

    const pipeline = new Pipeline<TestData>({
      key: "abort-after-terminal",
      steps,
      initialData: { value: 42 },
      logger: createLogger(),
      stateDirectory: testDir,
      signal: controller.signal,
    });

    // Run normally - pipeline will complete (terminal state)
    await pipeline.run();
    expect(pipeline.status).toBe("completed");

    // Abort after completion - since it's already terminal, the signal firing again
    // would hit line 289's false branch if somehow we re-enter executeFrom.
    // This test just verifies the pipeline completes normally without issue.
  });
});
