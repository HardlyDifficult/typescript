# @hardlydifficult/workflow-engine

A powerful workflow and pipeline execution engine with persistence, lifecycle management, and flexible execution patterns.

## Installation

```bash
npm install @hardlydifficult/workflow-engine @hardlydifficult/state-tracker
```

Optionally, for pipeline support:

```bash
npm install @hardlydifficult/logger
```

## Features

- **Pipeline Execution**: Define linear sequences of steps with automatic state management and persistence
- **Gate Steps**: Pause pipeline execution and resume later with optional data
- **Retry Logic**: Automatic retry with recovery functions for failed steps
- **Lifecycle Hooks**: Customizable hooks for step start/complete/failed events
- **Persistence**: Automatic state saving and recovery across restarts
- **Cancellation**: Graceful cancellation with AbortSignal support
- **Data Accumulation**: Steps receive accumulated data from all previous steps
- **Status Tracking**: Clear status strings (`running:step`, `gate:step`, `completed`, `failed`, `cancelled`)

## Quick Start

```typescript
import { Pipeline } from "@hardlydifficult/workflow-engine";
import { Logger } from "@hardlydifficult/logger";

// Define steps
const steps = [
  {
    name: "create_plan",
    execute: async () => ({ plan: "create resources" }),
  },
  {
    name: "approve",
    gate: true, // Pause here until resume() is called
  },
  {
    name: "execute_plan",
    execute: async ({ data }) => {
      console.log(`Executing: ${data.plan}`);
      return { executed: true };
    },
  },
];

// Create pipeline
const pipeline = new Pipeline({
  key: "my-pipeline-123",
  steps,
  initialData: {},
  logger: new Logger("info"),
  stateDirectory: "./pipeline-state",
});

// Run and wait at gate
await pipeline.run();
console.log(pipeline.status); // "gate:approve"

// Resume with optional data
await pipeline.resume({ approved: true });

// Check completion
console.log(pipeline.status); // "completed"
console.log(pipeline.data);   // { plan: "...", executed: true, approved: true }
```

## Step Types

### Regular Steps
Execute immediately and return data to accumulate:

```typescript
{
  name: "fetch_data",
  execute: async () => ({ data: "fetched" }),
}
```

### Gate Steps
Pause execution until `resume()` is called:

```typescript
{
  name: "manual_approval",
  gate: true,
}
```

Gate steps can also have execution logic:

```typescript
{
  name: "pre_approval_check",
  gate: true,
  execute: async () => ({ check_passed: true }),
}
```

### Retryable Steps

```typescript
{
  name: "flaky_api_call",
  retries: 3,
  execute: async ({ data }) => {
    const result = await callApi();
    if (!result.success) throw new Error("API failed");
    return result;
  },
  recover: async ({ data }) => {
    // Cleanup between retries
    return { retry_count: (data.retry_count || 0) + 1 };
  },
}
```

## General-Purpose Workflow Engine

A lower-level state machine with typed statuses, validated transitions, and persistent state.

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

#### `cursor<TItem>(selector)`

Creates a reusable cursor for safe navigation into nested engine data. Define the selector once, then use `get()`, `find()`, or `update()` without repeating navigation logic.

```typescript
interface Data { items: Array<{ name: string; done: boolean }>; currentIndex?: number; }

const item = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

item.get();       // returns item or throws "Cursor target not found"
item.find();      // returns item or undefined
await item.update((it) => { it.done = true; });            // persists, no-op if undefined
await item.update((it, d) => { d.currentIndex = undefined; }); // access parent data too
```

#### Updater Pattern

`transition()` and `update()` accept an updater callback that receives a `structuredClone` of the data. Mutate it directly — if the updater throws, nothing changes.

```typescript
await engine.transition("running", (draft) => {
  draft.count += 1;
  draft.result = computeResult();
});
```

## Lifecycle Hooks

```typescript
const pipeline = new Pipeline({
  key: "my-pipeline",
  steps,
  hooks: {
    onStepStart: (name) => console.log(`Starting: ${name}`),
    onStepComplete: (name, data) => console.log(`Completed: ${name}`),
    onGateReached: (name) => console.log(`Reached gate: ${name}`),
    onComplete: () => console.log("Pipeline completed"),
    onFailed: (name, error) => console.error(`Failed at ${name}: ${error}`),
  },
});
```

## Cancellation

```typescript
const controller = new AbortController();

const pipeline = new Pipeline({
  key: "my-pipeline",
  steps,
  signal: controller.signal,
});

await pipeline.run();

// Cancel from elsewhere
controller.abort();
```

## State Persistence

State is automatically saved to disk:

```typescript
const pipeline = new Pipeline({
  key: "my-pipeline",
  steps,
  stateDirectory: "./state",
  autoSaveMs: 1000, // Save every second (default)
});
```

## Pipeline API Reference

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

### Step Definition

```typescript
interface StepDefinition<TData> {
  name: string;
  execute?: (context: { data: TData }) => Promise<Partial<TData>>;
  gate?: boolean;
  retries?: number;
  recover?: (context: { data: TData }) => Promise<Partial<TData>>;
}
```

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

### Status Values

- `running:step_name` - Currently executing step
- `gate:gate_name` - Waiting at a gate
- `completed` - Successfully finished
- `failed` - Failed execution
- `cancelled` - Cancelled execution

## Error Handling

```typescript
try {
  await pipeline.run();
} catch (error) {
  if (error instanceof PipelineHasNoStepsError) {
    // Handle empty pipeline
  } else if (error instanceof DuplicatePipelineStepNameError) {
    // Handle duplicate step names
  } else if (error instanceof PipelineResumeError) {
    // Handle resume errors
    console.log(error.code); // "PIPELINE_NOT_AT_GATE"
  }
}
```

## Crash Recovery

Pipeline state is persisted automatically. On restart, `run()` detects the interrupted state:
- **Mid-step**: re-executes the step (steps should be idempotent)
- **At gate**: stays at gate, waiting for `resume()`
- **Terminal**: no-op

## Migration

See the [migration guide](./docs/migration.md) for upgrading from v0.x to v1.x.