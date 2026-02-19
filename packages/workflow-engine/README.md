# @hardlydifficult/workflow-engine

Typed workflow engine with state machines and a higher-level pipeline abstraction for linear step execution with persistence, gates, and retries.

## Installation

```bash
npm install @hardlydifficult/workflow-engine @hardlydifficult/state-tracker
```

For Pipeline support, also install:

```bash
npm install @hardlydifficult/logger
```

## Usage

### WorkflowEngine

General-purpose state machine with typed statuses, validated transitions, and persistent state.

```typescript
import { WorkflowEngine } from "@hardlydifficult/workflow-engine";

type Status = "idle" | "running" | "completed" | "failed";
interface Data {
  count: number;
  result?: string;
}

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

console.log(engine.status); // "completed"
console.log(engine.isTerminal); // true
console.log(engine.data); // { count: 1, result: "done" }
```

### Pipeline

Higher-level abstraction for linear workflows with gates, retries, and automatic lifecycle logging.

```typescript
import { Pipeline } from "@hardlydifficult/workflow-engine";
import { createLogger } from "@hardlydifficult/logger";

interface Data {
  prompt: string;
  plan?: string;
  approved?: boolean;
  result?: string;
}

const logger = createLogger("my-pipeline");

const pipeline = new Pipeline<Data>({
  key: "my-pipeline",
  steps: [
    {
      name: "create_plan",
      execute: async ({ data }) => {
        const plan = await generatePlan(data.prompt);
        return { plan };
      },
    },
    {
      name: "approve",
      gate: true,
      execute: async ({ data }) => {
        await postForApproval(data.plan);
        return {};
      },
    },
    {
      name: "implement",
      retries: 2,
      execute: async ({ data, signal }) => {
        const result = await implement(data.plan!, signal);
        return { result };
      },
      recover: async (error) => {
        await fixIssue(error);
        return {};
      },
    },
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

## API Reference

### WorkflowEngine

#### Constructor

```typescript
new WorkflowEngine<TStatus, TData>(options: WorkflowEngineOptions<TStatus, TData>)
```

| Option | Type | Description |
|--------|------|-------------|
| `key` | `string` | Unique persistence key |
| `initialStatus` | `TStatus` | Default status for new workflows |
| `initialData` | `TData` | Default data for new workflows |
| `transitions` | `TransitionMap<TStatus>` | Allowed transitions per status |
| `stateDirectory?` | `string` | Persistence directory |
| `autoSaveMs?` | `number` | Auto-save interval (default 5000) |
| `onTransition?` | `(event: TransitionEvent<TStatus, TData>) => void` | Event callback |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `status` | `TStatus` | Current status |
| `data` | `Readonly<TData>` | Current data |
| `isLoaded` | `boolean` | Whether `load()` has been called |
| `isPersistent` | `boolean` | Whether disk storage is available |
| `isTerminal` | `boolean` | Whether current status has no outgoing transitions |
| `updatedAt` | `string` | ISO timestamp of last transition or update |

#### Methods

##### `load()`

Load persisted state from disk. Uses defaults if no state file exists. Safe to call multiple times.

```typescript
await engine.load();
```

##### `transition(to, updater?)`

Change status, optionally mutate data. Validates transition, persists immediately.

```typescript
await engine.transition("running", (draft) => {
  draft.count += 1;
  draft.result = computeResult();
});
```

The updater receives a `structuredClone` of the data. If the updater throws, nothing changes.

##### `update(updater)`

Mutate data without changing status. Persists immediately.

```typescript
await engine.update((draft) => {
  draft.count = 100;
});
```

##### `cursor(selector)`

Create a `DataCursor` for safe nested data access.

```typescript
interface Data {
  items: Array<{ name: string; done: boolean }>;
  currentIndex?: number;
}

const item = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

item.get(); // returns item or throws "Cursor target not found"
item.find(); // returns item or undefined
await item.update((it) => {
  it.done = true;
}); // persists, no-op if undefined
await item.update((it, d) => {
  d.currentIndex = undefined;
}); // access parent data too
```

##### `canTransition(to)`

Check if a transition is allowed from current status.

```typescript
if (engine.canTransition("completed")) {
  await engine.transition("completed");
}
```

##### `allowedTransitions()`

List statuses reachable from current status.

```typescript
const allowed = engine.allowedTransitions(); // ["running", "failed"]
```

##### `save()`

Force-save current state to disk.

```typescript
await engine.save();
```

##### `on(listener)`

Subscribe to change events. Returns an unsubscribe function.

```typescript
const unsubscribe = engine.on((event) => {
  console.log(event.type, event.status);
});

// Later:
unsubscribe();
```

##### `toSnapshot()`

Return a read-only snapshot of the engine's current state.

```typescript
const snapshot = engine.toSnapshot();
// { status, data, updatedAt, isTerminal }
```

### DataCursor

Reusable cursor for safe navigation into nested engine data.

#### Methods

##### `get()`

Get the selected item. Throws if the selector returns undefined.

```typescript
const item = cursor.get();
```

##### `find()`

Get the selected item, or undefined.

```typescript
const item = cursor.find();
if (item) {
  // ...
}
```

##### `update(updater)`

Update the selected item (and optionally the parent data). No-op if the selector returns undefined.

```typescript
await cursor.update((item) => {
  item.status = "done";
});

await cursor.update((item, data) => {
  item.status = "done";
  data.total += 1;
});
```

### Pipeline

Linear sequence of steps with automatic state management, persistence, and lifecycle logging.

#### Constructor

```typescript
new Pipeline<TData>(options: PipelineOptions<TData>)
```

| Option | Type | Description |
|--------|------|-------------|
| `key` | `string` | Unique persistence key |
| `steps` | `StepDefinition<TData>[]` | Ordered list of step definitions |
| `initialData` | `TData` | Initial accumulated data |
| `logger` | `Logger` | Logger instance (all lifecycle events logged automatically) |
| `stateDirectory?` | `string` | Persistence directory |
| `autoSaveMs?` | `number` | Auto-save interval (default 5000) |
| `hooks?` | `PipelineHooks<TData>` | Lifecycle hooks for external integrations |
| `signal?` | `AbortSignal` | Abort signal for cancellation |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `status` | `string` | e.g. `"running:create_plan"`, `"gate:approve"`, `"completed"`, `"failed"` |
| `data` | `Readonly<TData>` | Accumulated output data |
| `steps` | `readonly StepState[]` | Per-step runtime state |
| `currentStep` | `string \| undefined` | Name of current step, or `undefined` if terminal |
| `isTerminal` | `boolean` | Whether pipeline is in a terminal state |
| `isWaitingAtGate` | `boolean` | Whether pipeline is paused at a gate |

#### Methods

##### `run()`

Start or resume from crash. Loads persisted state, re-executes interrupted steps.

```typescript
await pipeline.run();
```

- **Fresh pipeline**: executes from step 0
- **Interrupted mid-step**: re-executes that step (steps should be idempotent)
- **Waiting at gate**: stays at gate (call `resume()` to continue)
- **Terminal**: no-op

##### `resume(data?)`

Continue past a gate, optionally merging partial data.

```typescript
await pipeline.resume({ approved: true });
```

Throws if the pipeline is not currently at a gate.

##### `cancel()`

Transition to cancelled, abort signal fires.

```typescript
await pipeline.cancel();
```

##### `on(listener)`

Subscribe to changes. Returns an unsubscribe function.

```typescript
const unsubscribe = pipeline.on((event) => {
  console.log(event.status, event.data);
});
```

##### `toSnapshot()`

Return a read-only snapshot of `{ status, data, steps, isTerminal }`.

```typescript
const snapshot = pipeline.toSnapshot();
```

### Step Definitions

#### Regular Step

Runs immediately, merges returned data.

```typescript
{
  name: "process",
  execute: async ({ data, signal }) => {
    const result = await process(data.input);
    return { result };
  }
}
```

#### Gate Step

Runs optional execute, then pauses until `resume()` is called.

```typescript
{
  name: "approval",
  gate: true,
  execute: async ({ data }) => {
    await postForApproval(data.plan);
    return {};
  }
}
```

#### Retryable Step

On failure, calls `recover()` then re-runs `execute`, up to N times.

```typescript
{
  name: "implement",
  retries: 2,
  execute: async ({ data, signal }) => {
    const result = await implement(data.plan, signal);
    return { result };
  },
  recover: async (error, { data }) => {
    await fixIssue(error);
    return {};
  }
}
```

### StepContext

Context passed to every step's execute function.

```typescript
interface StepContext<TData> {
  readonly data: Readonly<TData>;
  readonly signal: AbortSignal;
}
```

### PipelineHooks

All hooks are optional. Hook errors are swallowed to avoid breaking pipeline execution.

| Hook | Arguments | When |
|------|-----------|------|
| `onStepStart` | `(name, data)` | Before a step executes |
| `onStepComplete` | `(name, data)` | After a step succeeds |
| `onStepFailed` | `(name, error, data)` | When a step fails (after all retries) |
| `onGateReached` | `(name, data)` | When a gate step pauses |
| `onComplete` | `(data)` | When all steps finish |
| `onFailed` | `(name, error, data)` | When pipeline enters failed state |

```typescript
const hooks: PipelineHooks<Data> = {
  onStepComplete: (name, data) => {
    console.log(`${name} completed with`, data);
  },
  onGateReached: (name, data) => {
    notifyUser(`Approval needed at ${name}`);
  },
};
```

### StepState

Runtime state of a single step, persisted inside PipelineData.

```typescript
interface StepState {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "gate_waiting";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  attempts: number;
}
```

### TransitionEvent

Event emitted on transitions, updates, and loads.

```typescript
interface TransitionEvent<TStatus, TData> {
  type: "transition" | "update" | "load";
  from?: TStatus;
  to?: TStatus;
  status: TStatus;
  data: Readonly<TData>;
  timestamp: string;
}
```

### TransitionMap

Allowed transitions per status. Statuses with empty arrays are terminal.

```typescript
type TransitionMap<TStatus extends string> = Record<TStatus, readonly TStatus[]>;

const transitions: TransitionMap<Status> = {
  idle: ["running", "failed"],
  running: ["paused", "completed", "failed"],
  paused: ["running", "failed"],
  completed: [],
  failed: [],
};
```

## Crash Recovery

Pipeline state is persisted automatically. On restart, `run()` detects the interrupted state:

- **Mid-step**: re-executes the step (steps should be idempotent)
- **At gate**: stays at gate, waiting for `resume()`
- **Terminal**: no-op

```typescript
// First run — crashes during step_b
const pipeline1 = new Pipeline({ key: "my-pipeline", steps, initialData, logger });
await pipeline1.run(); // crashes

// Second run — resumes from step_b
const pipeline2 = new Pipeline({ key: "my-pipeline", steps, initialData, logger });
await pipeline2.run(); // re-executes step_b, continues
```