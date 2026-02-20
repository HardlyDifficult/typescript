# @hardlydifficult/daemon

Idempotent resource teardown with signal trapping and LIFO cleanup ordering.

## Installation

```bash
npm install @hardlydifficult/daemon
```

## Quick Start

```typescript
import { createTeardown, runContinuousLoop } from "@hardlydifficult/daemon";

// Register cleanup functions
const teardown = createTeardown();
teardown.add(() => console.log("Closing server"));
teardown.add(() => console.log("Closing database"));
teardown.trapSignals();

// Run teardown when ready
await teardown.run();
// Logs:
// Closing database
// Closing server
```

## Teardown Management

Resource cleanup registry with idempotent execution and LIFO ordering.

### `createTeardown()`

Creates a teardown registry for managing resource cleanup.

```typescript
const teardown = createTeardown();
```

#### `.add(fn: () => void | Promise<void>): () => void`

Registers a teardown function. Returns an unregister function.

```typescript
const teardown = createTeardown();
const unregister = teardown.add(async () => {
  await server.close();
});

// Unregister before teardown if needed
unregister();
```

#### `.run(): Promise<void>`

Runs all teardown functions in LIFO order. Idempotent — subsequent calls are no-ops.

```typescript
const teardown = createTeardown();
teardown.add(() => console.log("First"));
teardown.add(() => console.log("Second"));

await teardown.run();
// Logs:
// Second
// First
```

#### `.trapSignals(): () => void`

Wires SIGTERM/SIGINT handlers to run teardown and exit. Returns an untrap function to remove handlers.

```typescript
const teardown = createTeardown();
const untrap = teardown.trapSignals();

// Later, to stop trapping signals
untrap();
```

## Continuous Loop Execution

Runs cyclic tasks with graceful shutdown support.

### `runContinuousLoop(options: ContinuousLoopOptions): Promise<void>`

Executes a cycle function repeatedly with interruptible sleep and signal handling.

```typescript
import { runContinuousLoop } from "@hardlydifficult/daemon";

await runContinuousLoop({
  intervalSeconds: 5,
  runCycle: async (isShutdownRequested) => {
    if (isShutdownRequested()) {
      return;
    }
    // Perform work here
    console.log("Running cycle...");
  },
  onShutdown: async () => {
    console.log("Shutdown complete");
  }
});
```

#### Options

| Name              | Type                            | Description                                    |
|-------------------|---------------------------------|------------------------------------------------|
| `intervalSeconds` | `number`                        | Interval between cycles in seconds             |
| `runCycle`        | `(isShutdownRequested: () => boolean) => Promise<unknown>` | Callback to run each cycle (shutdown check provided) |
| `onShutdown?`     | `() => Promise<void>`           | Optional cleanup callback after shutdown       |