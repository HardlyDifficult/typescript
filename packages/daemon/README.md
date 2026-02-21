# @hardlydifficult/daemon

Graceful shutdown and continuous loop utilities for Node.js daemon processes.

## Installation

```bash
npm install @hardlydifficult/daemon
```

## Quick Start

```typescript
import { createTeardown, runContinuousLoop } from "@hardlydifficult/daemon";

const teardown = createTeardown();

// Register cleanup functions
teardown.add(() => console.log("Stopping server"));
teardown.add(() => console.log("Closing database connection"));

// Handle SIGINT/SIGTERM
teardown.trapSignals();

// Run a background task loop
await runContinuousLoop({
  intervalSeconds: 5,
  runCycle: async (isShutdownRequested) => {
    if (isShutdownRequested()) return;
    console.log("Running periodic task...");
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { stop: false };
  },
  onShutdown: async () => {
    console.log("Shutting down loop");
  }
});

// Manual shutdown
await teardown.run();
```

## Teardown Management

Idempotent resource teardown with signal trapping and LIFO cleanup order.

### createTeardown()

Creates a teardown registry for managing cleanup functions.

**Features:**
- Registers cleanup functions in order; runs them in LIFO order
- Swallows errors per-function so remaining cleanup still executes
- Idempotent: calling `run()` multiple times has no additional effect
- Signal trapping for SIGINT/SIGTERM that calls `run()` then exits
- Returns an unregister function for individual registrations

```typescript
const teardown = createTeardown();

// Add cleanup functions
const unregister = teardown.add(() => server.close());
teardown.add(() => db.close());

// Unregister a specific function if needed
unregister();

// Handle OS signals
teardown.trapSignals();

// Run all cleanup
await teardown.run();
```

#### Teardown Interface

| Method | Description |
|--------|-------------|
| `add(fn)` | Registers a cleanup function (sync or async); returns unregister function |
| `run()` | Runs all registered cleanup functions in LIFO order; idempotent |
| `trapSignals()` | Attaches SIGINT/SIGTERM handlers; returns untrap function |

### Signal Trapping

Signal handlers are attached via `trapSignals()` and call `run()` then `process.exit(0)`.

```typescript
const untrap = teardown.trapSignals();
// Later, if needed:
untrap(); // Remove signal handlers
```

## Continuous Loop Execution

Interruptible loop with configurable cycle interval, error handling, and graceful shutdown.

### runContinuousLoop()

Runs a function repeatedly with signal-aware sleep that can be interrupted.

```typescript
await runContinuousLoop({
  intervalSeconds: 10,
  runCycle: async (isShutdownRequested) => {
    if (isShutdownRequested()) {
      return { stop: true };
    }
    await doWork();
    // Return a delay override
    return 5000; // milliseconds
  },
  onCycleError: async (error, context) => {
    console.error(`Cycle ${context.cycleNumber} failed:`, error);
    return "continue"; // or "stop"
  },
  onShutdown: async () => {
    await cleanup();
  }
});
```

#### Loop Lifecycle

- Runs cycles indefinitely until:
  - `SIGINT` or `SIGTERM` is received
  - `runCycle` returns `{ stop: true }`
  - `onCycleError` returns `"stop"`
- Each cycle may override the default delay or signal immediate continuation

### Options

| Option | Type | Description |
|--------|------|-------------|
| `intervalSeconds` | `number` | Default delay between cycles (seconds) |
| `runCycle` | `(isShutdownRequested: () => boolean) => Promise<...>` | Function to run each cycle |
| `getNextDelayMs?` | `(result, context) => ContinuousLoopDelay` | Derive delay from cycle result |
| `onCycleError?` | `(error, context) => "continue" \| "stop"` | Handle cycle errors |
| `onShutdown?` | `() => void \| Promise<void>` | Cleanup after shutdown |
| `logger?` | `ContinuousLoopLogger` | Optional custom logger |

### Cycle Return Values

Cycles may return:
- A delay in milliseconds (e.g., `5000`)
- `"immediate"` to continue without delay
- `{ stop: true }` to end the loop
- `{ nextDelayMs: number \| "immediate" }` to override delay

If the cycle returns a domain-specific result, use `getNextDelayMs` to derive the next delay.

### Error Handling

By default:
- Errors are logged to `console.error`
- Loop continues to next cycle

Custom error handling via `onCycleError` can override behavior:

```typescript
onCycleError: async (error, context) => {
  if (error instanceof FatalError) {
    return "stop"; // Terminate loop
  }
  return "continue"; // Proceed
}
```

### Context Types

#### ContinuousLoopCycleContext

| Field | Type | Description |
|-------|------|-------------|
| `cycleNumber` | `number` | 1-based cycle number |
| `isShutdownRequested` | `() => boolean` | Check shutdown status |

#### ContinuousLoopErrorContext

Identical to `ContinuousLoopCycleContext`; passed to `onCycleError`.

#### ContinuousLoopLogger

| Method | Parameters | Description |
|--------|------------|-------------|
| `warn(message, context?)` | `string`, `Record<string, unknown>` | Warning log |
| `error(message, context?)` | `string`, `Record<string, unknown>` | Error log |

Default logger uses `console.warn`/`console.error`.