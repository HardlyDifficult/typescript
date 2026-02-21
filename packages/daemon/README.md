# @hardlydifficult/daemon

A utility library for building long-running Node.js processes with graceful shutdown and continuous background task execution.

## Installation

```bash
npm install @hardlydifficult/daemon
```

## Quick Start

```typescript
import { runContinuousLoop, createTeardown } from "@hardlydifficult/daemon";

// Setup graceful shutdown
const teardown = createTeardown();
teardown.add(() => console.log("Shutting down..."));
teardown.trapSignals();

// Run a background task every 5 seconds
await runContinuousLoop({
  intervalSeconds: 5,
  runCycle: async (isShutdownRequested) => {
    console.log("Running cycle...");
    if (isShutdownRequested()) return { stop: true };
    return { nextDelayMs: "immediate" };
  },
  onShutdown: async () => {
    await teardown.run();
  }
});
```

## Graceful Shutdown with `createTeardown`

Manages resource cleanup with LIFO execution order, signal trapping for SIGINT/SIGTERM, and idempotent teardown behavior.

### Core API

#### `createTeardown(): Teardown`

Creates a teardown manager for registering cleanup functions.

```typescript
const teardown = createTeardown();

// Add cleanup functions
teardown.add(() => server.close());
teardown.add(() => db.close());

// Or use async functions
teardown.add(async () => {
  await flushPendingWrites();
});
```

#### `Teardown.add(fn): () => void`

Registers a cleanup function. Returns an unregister function for removing it.

```typescript
const unregister = teardown.add(() => cleanup());

// Later, remove it
unregister();
```

#### `Teardown.run(): Promise<void>`

Runs all cleanup functions in LIFO order. Safe to call multiple times—subsequent calls are no-ops.

```typescript
await teardown.run(); // Runs last-in-first-out
```

#### `Teardown.trapSignals(): () => void`

Wires SIGINT/SIGTERM to automatically call `run()` then `process.exit(0)`.

```typescript
const untrap = teardown.trapSignals();

// Later, restore default behavior
untrap();
```

### Behavior Notes

- Errors in teardown functions are caught and logged, allowing remaining functions to complete.
- Signal handlers are added only once per process and cleaned up automatically when untrap() is called.

## Continuous Loop with `runContinuousLoop`

Runs a recurring task in a loop with built-in signal handling, dynamic delays, and configurable error policies.

### Core Options

| Option | Type | Description |
|--------|------|-------------|
| `intervalSeconds` | `number` | Default delay between cycles in seconds |
| `runCycle` | `() => Promise<RunCycleResult>` | Main function executed per cycle |
| `getNextDelayMs` | `() => Delay \| undefined` | Optional custom delay resolver |
| `onCycleError` | `ErrorHandler` | Custom error handling strategy |
| `onShutdown` | `() => Promise<void>` | Cleanup hook called on shutdown |
| `logger` | `ContinuousLoopLogger` | Optional logger (defaults to console) |

### Return Values from `runCycle`

You can control loop behavior by returning one of:

- **Delay value**: `number` (ms) or `"immediate"` to skip delay
- **Control object**: `{ stop?: boolean; nextDelayMs?: Delay }`

```typescript
await runContinuousLoop({
  intervalSeconds: 10,
  runCycle: async () => {
    // Skip delay after this cycle
    return "immediate";
  }
});
```

### Example: Backoff Loop

```typescript
import { runContinuousLoop } from "@hardlydifficult/daemon";

type Result = { backoffMs: number } | { success: true };

await runContinuousLoop({
  intervalSeconds: 60,
  runCycle: async () => {
    const success = await attemptTask();
    return success 
      ? { success: true } 
      : { backoffMs: Math.min(60_000, Math.random() * 5_000) };
  },
  getNextDelayMs: (result) => 
    "backoffMs" in result ? result.backoffMs : undefined,
  onShutdown: () => console.log("Stopping loop"),
});
```

### Error Handling

By default, cycle errors are logged to console and the loop continues. Custom error handling:

```typescript
await runContinuousLoop({
  intervalSeconds: 5,
  runCycle: async () => { throw new Error("fail"); },
  onCycleError: async (error, context) => {
    console.error(`Cycle ${context.cycleNumber} failed: ${error.message}`);
    return "stop"; // or "continue"
  }
});
```

### Shutdown Signals

The loop responds to `SIGINT` and `SIGTERM` by stopping after the current cycle completes. Use `isShutdownRequested()` inside `runCycle` to abort long-running work:

```typescript
await runContinuousLoop({
  intervalSeconds: 1,
  runCycle: async (isShutdownRequested) => {
    while (!isShutdownRequested()) {
      await processChunk();
    }
    return { stop: true };
  }
});
```