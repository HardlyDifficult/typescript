import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger } from "@hardlydifficult/logger";
import { Pipeline } from "../src/Pipeline.js";
import type {
  StepDefinition,
  PipelineHooks,
  StepState,
} from "../src/pipelineTypes.js";

// --- Test helpers ---

interface TestData {
  a?: number;
  b?: string;
  c?: boolean;
  recovered?: boolean;
  gateValue?: string;
}

let testDir: string;

function createLogger(): Logger {
  return new Logger("debug");
}

function createPipeline(
  steps: StepDefinition<TestData>[],
  overrides: {
    key?: string;
    initialData?: TestData;
    hooks?: PipelineHooks<TestData>;
    signal?: AbortSignal;
  } = {}
): Pipeline<TestData> {
  return new Pipeline<TestData>({
    key: overrides.key ?? "test-pipeline",
    steps,
    initialData: overrides.initialData ?? {},
    logger: createLogger(),
    stateDirectory: testDir,
    autoSaveMs: 0,
    hooks: overrides.hooks,
    signal: overrides.signal,
  });
}

// --- Tests ---

describe("Pipeline", () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-test-"));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("throws if steps array is empty", () => {
      expect(
        () =>
          new Pipeline({
            key: "test",
            steps: [],
            initialData: {},
            logger: createLogger(),
            stateDirectory: testDir,
          })
      ).toThrow("Pipeline requires at least one step");
    });

    it("throws if step names are not unique", () => {
      expect(() =>
        createPipeline([
          { name: "step_a", execute: async () => ({}) },
          { name: "step_a", execute: async () => ({}) },
        ])
      ).toThrow('Duplicate step name: "step_a"');
    });

    it("creates pipeline with valid step definitions", () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);
      expect(pipeline.status).toBe("running:step_a");
    });
  });

  describe("basic execution", () => {
    it("executes all steps in order", async () => {
      const order: string[] = [];
      const pipeline = createPipeline([
        {
          name: "step_a",
          execute: async () => {
            order.push("a");
            return { a: 1 };
          },
        },
        {
          name: "step_b",
          execute: async () => {
            order.push("b");
            return { b: "hello" };
          },
        },
        {
          name: "step_c",
          execute: async () => {
            order.push("c");
            return { c: true };
          },
        },
      ]);

      await pipeline.run();

      expect(order).toEqual(["a", "b", "c"]);
      expect(pipeline.data).toEqual({ a: 1, b: "hello", c: true });
      expect(pipeline.status).toBe("completed");
      expect(pipeline.isTerminal).toBe(true);
    });

    it("accumulates data across steps", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
        {
          name: "step_b",
          execute: async ({ data }) => {
            expect(data.a).toBe(1);
            return { b: "from-b" };
          },
        },
      ]);

      await pipeline.run();

      expect(pipeline.data).toEqual({ a: 1, b: "from-b" });
    });

    it("single-step pipeline works", async () => {
      const pipeline = createPipeline([
        { name: "only", execute: async () => ({ a: 42 }) },
      ]);

      await pipeline.run();

      expect(pipeline.status).toBe("completed");
      expect(pipeline.data.a).toBe(42);
    });

    it("step returning empty object does not break accumulation", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
        { name: "step_b", execute: async () => ({}) },
        { name: "step_c", execute: async () => ({ c: true }) },
      ]);

      await pipeline.run();

      expect(pipeline.data).toEqual({ a: 1, c: true });
    });
  });

  describe("step lifecycle", () => {
    it("step status transitions through pending -> running -> completed", async () => {
      const snapshots: StepState[][] = [];

      const pipeline = createPipeline([
        {
          name: "step_a",
          execute: async () => ({ a: 1 }),
        },
        {
          name: "step_b",
          execute: async () => {
            // Capture state mid-execution
            snapshots.push(structuredClone(pipeline.steps) as StepState[]);
            return { b: "done" };
          },
        },
      ]);

      await pipeline.run();

      // During step_b execution, step_a should be completed
      expect(snapshots[0]![0]!.status).toBe("completed");
      expect(snapshots[0]![1]!.status).toBe("running");

      // After completion, both should be completed
      expect(pipeline.steps[0]!.status).toBe("completed");
      expect(pipeline.steps[1]!.status).toBe("completed");
    });

    it("sets startedAt when step begins", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);

      await pipeline.run();

      expect(pipeline.steps[0]!.startedAt).toBeTruthy();
      expect(new Date(pipeline.steps[0]!.startedAt!).toISOString()).toBe(
        pipeline.steps[0]!.startedAt
      );
    });

    it("sets completedAt when step finishes", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);

      await pipeline.run();

      expect(pipeline.steps[0]!.completedAt).toBeTruthy();
    });

    it("tracks attempts count", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);

      await pipeline.run();

      expect(pipeline.steps[0]!.attempts).toBe(1);
    });
  });

  describe("gate steps", () => {
    it("pauses at gate step", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
        { name: "approval", gate: true },
        { name: "step_b", execute: async () => ({ b: "after-gate" }) },
      ]);

      await pipeline.run();

      expect(pipeline.isWaitingAtGate).toBe(true);
      expect(pipeline.status).toBe("gate:approval");
      expect(pipeline.currentStep).toBe("approval");
      expect(pipeline.isTerminal).toBe(false);
    });

    it("resume() continues past gate", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
        { name: "approval", gate: true },
        { name: "step_b", execute: async () => ({ b: "after-gate" }) },
      ]);

      await pipeline.run();
      expect(pipeline.isWaitingAtGate).toBe(true);

      await pipeline.resume();

      expect(pipeline.status).toBe("completed");
      expect(pipeline.data).toEqual({ a: 1, b: "after-gate" });
    });

    it("resume() merges data", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
        { name: "approval", gate: true },
        {
          name: "step_b",
          execute: async ({ data }) => {
            expect(data.gateValue).toBe("approved");
            return { b: "used-gate-data" };
          },
        },
      ]);

      await pipeline.run();
      await pipeline.resume({ gateValue: "approved" });

      expect(pipeline.data.gateValue).toBe("approved");
      expect(pipeline.data.b).toBe("used-gate-data");
    });

    it("resume() throws if not at a gate", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);

      await pipeline.run();

      await expect(pipeline.resume()).rejects.toThrow(
        "Cannot resume: pipeline is not at a gate"
      );
    });

    it("gate step with execute runs before pausing", async () => {
      let executeRan = false;
      const pipeline = createPipeline([
        {
          name: "approval",
          gate: true,
          execute: async () => {
            executeRan = true;
            return { a: 42 };
          },
        },
        { name: "step_b", execute: async () => ({ b: "done" }) },
      ]);

      await pipeline.run();

      expect(executeRan).toBe(true);
      expect(pipeline.data.a).toBe(42);
      expect(pipeline.isWaitingAtGate).toBe(true);
    });

    it("single gate-step pipeline works", async () => {
      const pipeline = createPipeline([{ name: "approval", gate: true }]);

      await pipeline.run();

      expect(pipeline.isWaitingAtGate).toBe(true);

      await pipeline.resume();

      expect(pipeline.status).toBe("completed");
    });

    it("consecutive gates work", async () => {
      const pipeline = createPipeline([
        { name: "gate_a", gate: true },
        { name: "gate_b", gate: true },
        { name: "step_c", execute: async () => ({ c: true }) },
      ]);

      await pipeline.run();
      expect(pipeline.status).toBe("gate:gate_a");

      await pipeline.resume({ a: 1 });
      expect(pipeline.status).toBe("gate:gate_b");

      await pipeline.resume({ b: "hello" });
      expect(pipeline.status).toBe("completed");
      expect(pipeline.data).toEqual({ a: 1, b: "hello", c: true });
    });

    it("gate step execute failure transitions to failed", async () => {
      const pipeline = createPipeline([
        {
          name: "bad_gate",
          gate: true,
          execute: async () => {
            throw new Error("gate execute failed");
          },
        },
      ]);

      await pipeline.run();

      expect(pipeline.status).toBe("failed");
      expect(pipeline.steps[0]!.status).toBe("failed");
      expect(pipeline.steps[0]!.error).toBe("gate execute failed");
    });
  });

  describe("failure handling", () => {
    it("step throwing transitions to failed", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
        {
          name: "step_b",
          execute: async () => {
            throw new Error("step_b broke");
          },
        },
        { name: "step_c", execute: async () => ({ c: true }) },
      ]);

      await pipeline.run();

      expect(pipeline.status).toBe("failed");
      expect(pipeline.steps[1]!.status).toBe("failed");
      expect(pipeline.steps[1]!.error).toBe("step_b broke");
    });

    it("subsequent steps do not execute after failure", async () => {
      let stepCRan = false;
      const pipeline = createPipeline([
        {
          name: "step_a",
          execute: async () => {
            throw new Error("fail");
          },
        },
        {
          name: "step_b",
          execute: async () => {
            stepCRan = true;
            return {};
          },
        },
      ]);

      await pipeline.run();

      expect(stepCRan).toBe(false);
      expect(pipeline.steps[1]!.status).toBe("pending");
    });

    it("data accumulated before failure is preserved", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
        {
          name: "step_b",
          execute: async () => {
            throw new Error("fail");
          },
        },
      ]);

      await pipeline.run();

      expect(pipeline.data.a).toBe(1);
    });
  });

  describe("retries and recovery", () => {
    it("step with retries retries on failure", async () => {
      let attempts = 0;
      const pipeline = createPipeline([
        {
          name: "flaky",
          retries: 2,
          execute: async () => {
            attempts++;
            if (attempts < 3) throw new Error("not yet");
            return { a: attempts };
          },
        },
      ]);

      await pipeline.run();

      expect(pipeline.status).toBe("completed");
      expect(attempts).toBe(3);
      expect(pipeline.steps[0]!.attempts).toBe(3);
    });

    it("succeeds on first retry", async () => {
      let attempts = 0;
      const pipeline = createPipeline([
        {
          name: "flaky",
          retries: 1,
          execute: async () => {
            attempts++;
            if (attempts === 1) throw new Error("first try fails");
            return { a: attempts };
          },
        },
      ]);

      await pipeline.run();

      expect(pipeline.status).toBe("completed");
      expect(pipeline.data.a).toBe(2);
    });

    it("all retries exhausted transitions to failed", async () => {
      const pipeline = createPipeline([
        {
          name: "always_fails",
          retries: 2,
          execute: async () => {
            throw new Error("always broken");
          },
        },
      ]);

      await pipeline.run();

      expect(pipeline.status).toBe("failed");
      expect(pipeline.steps[0]!.attempts).toBe(3); // 1 original + 2 retries
      expect(pipeline.steps[0]!.error).toBe("always broken");
    });

    it("recovery function is called between retries", async () => {
      let recoveryCalled = false;
      let attempts = 0;
      const pipeline = createPipeline([
        {
          name: "with_recovery",
          retries: 1,
          execute: async ({ data }) => {
            attempts++;
            if (attempts === 1) throw new Error("need recovery");
            expect(data.recovered).toBe(true);
            return { a: 1 };
          },
          recover: async () => {
            recoveryCalled = true;
            return { recovered: true };
          },
        },
      ]);

      await pipeline.run();

      expect(recoveryCalled).toBe(true);
      expect(pipeline.status).toBe("completed");
      expect(pipeline.data.recovered).toBe(true);
    });

    it("recovery failure does not prevent retry", async () => {
      let attempts = 0;
      const pipeline = createPipeline([
        {
          name: "step",
          retries: 1,
          execute: async () => {
            attempts++;
            if (attempts === 1) throw new Error("first try");
            return { a: attempts };
          },
          recover: async () => {
            throw new Error("recovery also failed");
          },
        },
      ]);

      await pipeline.run();

      expect(pipeline.status).toBe("completed");
      expect(attempts).toBe(2);
    });

    it("step without retries fails immediately", async () => {
      let attempts = 0;
      const pipeline = createPipeline([
        {
          name: "no_retry",
          execute: async () => {
            attempts++;
            throw new Error("fail");
          },
        },
      ]);

      await pipeline.run();

      expect(attempts).toBe(1);
      expect(pipeline.status).toBe("failed");
    });
  });

  describe("cancellation", () => {
    it("cancel() transitions to cancelled", async () => {
      const pipeline = createPipeline([{ name: "gate", gate: true }]);

      await pipeline.run();

      await pipeline.cancel();

      expect(pipeline.status).toBe("cancelled");
      expect(pipeline.isTerminal).toBe(true);
    });

    it("cancel() on already terminal pipeline is a no-op", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);

      await pipeline.run();
      expect(pipeline.status).toBe("completed");

      await pipeline.cancel(); // should not throw

      expect(pipeline.status).toBe("completed");
    });

    it("aborted signal prevents next step from starting", async () => {
      const controller = new AbortController();
      let stepBRan = false;

      const pipeline = createPipeline(
        [
          {
            name: "step_a",
            execute: async () => {
              controller.abort();
              return { a: 1 };
            },
          },
          {
            name: "step_b",
            execute: async () => {
              stepBRan = true;
              return {};
            },
          },
        ],
        { signal: controller.signal }
      );

      await pipeline.run();

      expect(stepBRan).toBe(false);
      expect(pipeline.status).toBe("cancelled");
    });
  });

  describe("persistence", () => {
    it("state persists to disk", async () => {
      const pipeline1 = createPipeline([
        { name: "step_a", execute: async () => ({ a: 42 }) },
        { name: "gate", gate: true },
      ]);

      await pipeline1.run();

      // New instance with same key should load persisted state
      const pipeline2 = createPipeline([
        { name: "step_a", execute: async () => ({ a: 42 }) },
        { name: "gate", gate: true },
      ]);

      await pipeline2.run(); // loads persisted state

      expect(pipeline2.isWaitingAtGate).toBe(true);
      expect(pipeline2.data.a).toBe(42);
    });

    it("gate state survives restart", async () => {
      const steps: StepDefinition<TestData>[] = [
        { name: "step_a", execute: async () => ({ a: 1 }) },
        { name: "gate", gate: true },
        { name: "step_b", execute: async () => ({ b: "after" }) },
      ];

      const pipeline1 = createPipeline(steps);
      await pipeline1.run();
      expect(pipeline1.isWaitingAtGate).toBe(true);

      // Simulate restart
      const pipeline2 = createPipeline(steps);
      await pipeline2.run(); // loads, sees gate, stays
      expect(pipeline2.isWaitingAtGate).toBe(true);

      // Resume on the new instance
      await pipeline2.resume();
      expect(pipeline2.status).toBe("completed");
      expect(pipeline2.data.b).toBe("after");
    });

    it("completed pipeline stays completed on reload", async () => {
      const steps: StepDefinition<TestData>[] = [
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ];

      const pipeline1 = createPipeline(steps);
      await pipeline1.run();
      expect(pipeline1.status).toBe("completed");

      const pipeline2 = createPipeline(steps);
      await pipeline2.run();
      expect(pipeline2.status).toBe("completed");
    });

    it("failed pipeline stays failed on reload", async () => {
      let firstRun = true;
      const steps: StepDefinition<TestData>[] = [
        {
          name: "step_a",
          execute: async () => {
            if (firstRun) {
              firstRun = false;
              throw new Error("fail");
            }
            return { a: 1 };
          },
        },
      ];

      const pipeline1 = createPipeline(steps);
      await pipeline1.run();
      expect(pipeline1.status).toBe("failed");

      const pipeline2 = createPipeline(steps);
      await pipeline2.run();
      expect(pipeline2.status).toBe("failed"); // stays failed, doesn't re-execute
    });

    it("data accumulated before crash is preserved", async () => {
      let shouldFail = true;
      const steps: StepDefinition<TestData>[] = [
        { name: "step_a", execute: async () => ({ a: 1 }) },
        {
          name: "step_b",
          execute: async () => {
            if (shouldFail) {
              shouldFail = false;
              throw new Error("crash");
            }
            return { b: "recovered" };
          },
        },
      ];

      const pipeline1 = createPipeline(steps);
      await pipeline1.run();
      expect(pipeline1.status).toBe("failed");
      expect(pipeline1.data.a).toBe(1);
    });
  });

  describe("hooks", () => {
    it("onStepStart fires with correct step name", async () => {
      const started: string[] = [];
      const pipeline = createPipeline(
        [
          { name: "step_a", execute: async () => ({ a: 1 }) },
          { name: "step_b", execute: async () => ({ b: "x" }) },
        ],
        {
          hooks: { onStepStart: (name) => started.push(name) },
        }
      );

      await pipeline.run();

      expect(started).toEqual(["step_a", "step_b"]);
    });

    it("onStepComplete fires with accumulated data", async () => {
      const completed: Array<{ name: string; a?: number }> = [];
      const pipeline = createPipeline(
        [
          { name: "step_a", execute: async () => ({ a: 1 }) },
          { name: "step_b", execute: async () => ({ b: "x" }) },
        ],
        {
          hooks: {
            onStepComplete: (name, data) => completed.push({ name, a: data.a }),
          },
        }
      );

      await pipeline.run();

      expect(completed[0]).toEqual({ name: "step_a", a: 1 });
      expect(completed[1]).toEqual({ name: "step_b", a: 1 });
    });

    it("onGateReached fires when gate is hit", async () => {
      const gates: string[] = [];
      const pipeline = createPipeline(
        [
          { name: "step_a", execute: async () => ({ a: 1 }) },
          { name: "approval", gate: true },
        ],
        {
          hooks: { onGateReached: (name) => gates.push(name) },
        }
      );

      await pipeline.run();

      expect(gates).toEqual(["approval"]);
    });

    it("onComplete fires once", async () => {
      let completeCalls = 0;
      const pipeline = createPipeline(
        [
          { name: "step_a", execute: async () => ({ a: 1 }) },
          { name: "step_b", execute: async () => ({ b: "x" }) },
        ],
        {
          hooks: { onComplete: () => completeCalls++ },
        }
      );

      await pipeline.run();

      expect(completeCalls).toBe(1);
    });

    it("onStepFailed fires on failure", async () => {
      const failures: Array<{ name: string; error: string }> = [];
      const pipeline = createPipeline(
        [
          {
            name: "bad_step",
            execute: async () => {
              throw new Error("oops");
            },
          },
        ],
        {
          hooks: {
            onStepFailed: (name, error) => failures.push({ name, error }),
          },
        }
      );

      await pipeline.run();

      expect(failures).toEqual([{ name: "bad_step", error: "oops" }]);
    });

    it("onFailed fires with step name and error", async () => {
      const failures: Array<{ name: string; error: string }> = [];
      const pipeline = createPipeline(
        [
          {
            name: "bad_step",
            execute: async () => {
              throw new Error("oops");
            },
          },
        ],
        {
          hooks: {
            onFailed: (name, error) => failures.push({ name, error }),
          },
        }
      );

      await pipeline.run();

      expect(failures).toEqual([{ name: "bad_step", error: "oops" }]);
    });

    it("hook errors do not break pipeline execution", async () => {
      const pipeline = createPipeline(
        [
          { name: "step_a", execute: async () => ({ a: 1 }) },
          { name: "step_b", execute: async () => ({ b: "x" }) },
        ],
        {
          hooks: {
            onStepStart: () => {
              throw new Error("hook error");
            },
            onStepComplete: () => {
              throw new Error("hook error");
            },
          },
        }
      );

      await pipeline.run();

      expect(pipeline.status).toBe("completed");
      expect(pipeline.data).toEqual({ a: 1, b: "x" });
    });

    it("pipeline works with no hooks", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);

      await pipeline.run();

      expect(pipeline.status).toBe("completed");
    });
  });

  describe("currentStep", () => {
    it("returns current step name during execution", async () => {
      let captured: string | undefined;
      const pipeline = createPipeline(
        [
          { name: "step_a", execute: async () => ({ a: 1 }) },
          { name: "step_b", execute: async () => ({ b: "x" }) },
        ],
        {
          hooks: {
            onStepStart: (name) => {
              if (name === "step_b") {
                captured = pipeline.currentStep;
              }
            },
          },
        }
      );

      await pipeline.run();

      expect(captured).toBe("step_b");
    });

    it("returns undefined when terminal", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);

      await pipeline.run();

      expect(pipeline.currentStep).toBeUndefined();
    });
  });

  describe("toSnapshot", () => {
    it("returns correct shape", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
        { name: "gate", gate: true },
      ]);

      await pipeline.run();

      const snap = pipeline.toSnapshot();
      expect(snap.status).toBe("gate:gate");
      expect(snap.data.a).toBe(1);
      expect(snap.steps).toHaveLength(2);
      expect(snap.isTerminal).toBe(false);
    });

    it("data is a deep copy", async () => {
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);

      await pipeline.run();

      const snap = pipeline.toSnapshot();
      (snap.data as TestData).a = 999;
      expect(pipeline.data.a).toBe(1);
    });
  });

  describe("on() listener", () => {
    it("receives events on state changes", async () => {
      const events: string[] = [];
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
      ]);

      pipeline.on((event) => events.push(event.status));

      await pipeline.run();

      expect(events.length).toBeGreaterThan(0);
      expect(events[events.length - 1]).toBe("completed");
    });

    it("unsubscribe stops delivery", async () => {
      const events: string[] = [];
      const pipeline = createPipeline([
        { name: "step_a", execute: async () => ({ a: 1 }) },
        { name: "gate", gate: true },
        { name: "step_b", execute: async () => ({ b: "x" }) },
      ]);

      const unsub = pipeline.on((event) => events.push(event.status));
      await pipeline.run();
      const countAfterGate = events.length;
      unsub();
      await pipeline.resume();

      expect(events.length).toBe(countAfterGate);
    });
  });
});
