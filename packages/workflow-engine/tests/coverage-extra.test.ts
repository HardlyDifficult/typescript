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
  it("aborts the controller immediately when the signal is already aborted", () => {
    const controller = new AbortController();
    controller.abort(); // abort before creating Pipeline

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

    // The pipeline's abort signal should be aborted
    expect(pipeline.signal.aborted).toBe(true);
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

    // Transition should throw because onTransitionCb throws
    await expect(engine.transition("running")).rejects.toThrow(
      "transition callback error"
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
