# @hardlydifficult/workflow-engine

General-purpose state machine with typed statuses, validated transitions, and persistent state.

## Installation

```bash
npm install @hardlydifficult/workflow-engine @hardlydifficult/state-tracker
```

## Usage

```typescript
import { WorkflowEngine } from "@hardlydifficult/workflow-engine";

type Status = "idle" | "running" | "completed" | "failed";
interface Data { count: number; result?: string; }

const engine = new WorkflowEngine<Status, Data>({
  key: "my-workflow",
  initialStatus: "idle",
  initialData: { count: 0 },
  transitions: {
    idle: ["running", "failed"],
    running: ["completed", "failed"],
    completed: [],
    failed: [],
  },
  stateDirectory: "/var/data",
  onTransition: (event) => console.log(`${event.from} -> ${event.to}`),
});

await engine.load();

await engine.transition("running", (draft) => {
  draft.count = 1;
});

await engine.transition("completed", (draft) => {
  draft.result = "done";
});

engine.isTerminal; // true
```

## API

### `new WorkflowEngine<TStatus, TData>(options)`

| Option | Type | Description |
|--------|------|-------------|
| `key` | `string` | Unique persistence key |
| `initialStatus` | `TStatus` | Default status for new workflows |
| `initialData` | `TData` | Default data for new workflows |
| `transitions` | `Record<TStatus, TStatus[]>` | Allowed transitions per status |
| `stateDirectory` | `string?` | Persistence directory |
| `autoSaveMs` | `number?` | Auto-save interval (default 5000) |
| `onTransition` | `function?` | Event callback |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `status` | `TStatus` | Current status |
| `data` | `Readonly<TData>` | Current data |
| `isLoaded` | `boolean` | Whether `load()` has been called |
| `isPersistent` | `boolean` | Whether disk storage is available |
| `isTerminal` | `boolean` | Whether current status has no outgoing transitions |

### Methods

| Method | Description |
|--------|-------------|
| `load()` | Load persisted state from disk. Safe to call multiple times. |
| `transition(to, updater?)` | Change status, optionally mutate data. Validates transition, persists immediately. |
| `update(updater)` | Mutate data without changing status. Persists immediately. |
| `save()` | Force-save current state to disk. |
| `cursor(selector)` | Create a `DataCursor` for safe nested data access with `get()`, `find()`, `update()`. |
| `canTransition(to)` | Check if a transition is allowed from current status. |
| `allowedTransitions()` | List statuses reachable from current status. |

### `cursor<TItem>(selector)`

Creates a reusable cursor for safe navigation into nested engine data. Define the selector once, then use `get()`, `find()`, or `update()` without repeating navigation logic.

```typescript
interface Data { items: Array<{ name: string; done: boolean }>; currentIndex?: number; }

const item = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

item.get();       // returns item or throws "Cursor target not found"
item.find();      // returns item or undefined
await item.update((it) => { it.done = true; });            // persists, no-op if undefined
await item.update((it, d) => { d.currentIndex = undefined; }); // access parent data too
```

### Updater Pattern

`transition()` and `update()` accept an updater callback that receives a `structuredClone` of the data. Mutate it directly — if the updater throws, nothing changes.

```typescript
await engine.transition("running", (draft) => {
  draft.count += 1;
  draft.result = computeResult();
});
```

---

## Pipeline

A higher-level abstraction that manages a linear sequence of steps, wrapping `WorkflowEngine` internally. Supports gates (pause for external input), retries with recovery, cancellation via `AbortSignal`, and automatic lifecycle logging.

### Installation

Requires `@hardlydifficult/logger` as a peer dependency:

```bash
npm install @hardlydifficult/workflow-engine @hardlydifficult/state-tracker @hardlydifficult/logger
```

### Usage

```typescript
import { Pipeline } from "@hardlydifficult/workflow-engine";
import { createLogger } from "@hardlydifficult/logger";

interface Data { prompt: string; plan?: string; approved?: boolean; result?: string; }

const logger = createLogger("my-pipeline");

const pipeline = new Pipeline<Data>({
  key: "my-pipeline",
  steps: [
    { name: "create_plan", execute: async ({ data }) => {
      const plan = await generatePlan(data.prompt);
      return { plan };
    }},
    { name: "approve", gate: true, execute: async ({ data }) => {
      await postForApproval(data.plan);
      return {};
    }},
    { name: "implement", retries: 2, execute: async ({ data, signal }) => {
      const result = await implement(data.plan!, signal);
      return { result };
    }, recover: async (error) => {
      await fixIssue(error);
      return {};
    }},
  ],
  initialData: { prompt: "Build a feature" },
  logger,
  stateDirectory: "/var/data",
  hooks: {
    onStepComplete: (name) => console.log(`${name} done`),
    onGateReached: (name) => console.log(`Waiting at ${name}`),
  },
});

await pipeline.run();
// Pipeline pauses at "approve" gate...

// Later, on approval:
await pipeline.resume({ approved: true });
// Pipeline continues through "implement" and completes
```

### Step Types

| Type | Definition | Behavior |
|------|-----------|----------|
| Regular | `{ name, execute }` | Runs immediately, merges returned data |
| Gate | `{ name, gate: true, execute? }` | Runs optional execute, then pauses until `resume()` is called |
| Retryable | `{ name, execute, retries, recover? }` | On failure, calls `recover()` then re-runs `execute`, up to N times |

### `new Pipeline<TData>(options)`

| Option | Type | Description |
|--------|------|-------------|
| `key` | `string` | Unique persistence key |
| `steps` | `StepDefinition<TData>[]` | Ordered list of step definitions |
| `initialData` | `TData` | Initial accumulated data |
| `logger` | `Logger` | Logger instance (all lifecycle events logged automatically) |
| `stateDirectory` | `string?` | Persistence directory |
| `autoSaveMs` | `number?` | Auto-save interval (default 5000) |
| `hooks` | `PipelineHooks<TData>?` | Lifecycle hooks for external integrations |
| `signal` | `AbortSignal?` | Abort signal for cancellation |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `status` | `string` | e.g. `"running:create_plan"`, `"gate:approve"`, `"completed"`, `"failed"` |
| `data` | `Readonly<TData>` | Accumulated output data |
| `steps` | `StepState[]` | Per-step runtime state |
| `currentStep` | `string?` | Name of current step, or `undefined` if terminal |
| `isTerminal` | `boolean` | Whether pipeline is in a terminal state |
| `isWaitingAtGate` | `boolean` | Whether pipeline is paused at a gate |

### Methods

| Method | Description |
|--------|-------------|
| `run()` | Start or resume from crash. Loads persisted state, re-executes interrupted steps. |
| `resume(data?)` | Continue past a gate, optionally merging partial data. |
| `cancel()` | Transition to cancelled, abort signal fires. |
| `on(listener)` | Subscribe to changes. Returns unsubscribe function. |
| `toSnapshot()` | Return a read-only snapshot of `{ status, data, steps, isTerminal }`. |

### Hooks

All hooks are optional. Hook errors are swallowed to avoid breaking pipeline execution.

| Hook | Arguments | When |
|------|-----------|------|
| `onStepStart` | `(name, data)` | Before a step executes |
| `onStepComplete` | `(name, data)` | After a step succeeds |
| `onStepFailed` | `(name, error, data)` | When a step fails (after all retries) |
| `onGateReached` | `(name, data)` | When a gate step pauses |
| `onComplete` | `(data)` | When all steps finish |
| `onFailed` | `(name, error, data)` | When pipeline enters failed state |

### Crash Recovery

Pipeline state is persisted automatically. On restart, `run()` detects the interrupted state:
- **Mid-step**: re-executes the step (steps should be idempotent)
- **At gate**: stays at gate, waiting for `resume()`
- **Terminal**: no-op
