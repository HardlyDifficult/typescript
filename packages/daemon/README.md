# @hardlydifficult/daemon

Opinionated utilities for long-running Node.js services:

- `createTeardown()` for idempotent cleanup with signal trapping
- `runContinuousLoop()` for daemon-style cycle execution

## Installation

```bash
npm install @hardlydifficult/daemon
```

## Quick Start

Create a daemon with signal-trapped teardown and a continuous loop:

```typescript
import { createTeardown, runContinuousLoop } from "@hardlydifficult/daemon";

const teardown = createTeardown();

// Register cleanup for resources
teardown.add(() => console.log("Cleanup: closing server"));
teardown.add(() => console.log("Cleanup: disconnecting database"));

// Trap SIGINT/SIGTERM
teardown.trapSignals();

// Run a continuous loop
await runContinuousLoop({
  intervalSeconds: 5,
  async runCycle(isShutdownRequested) {
    console.log("Running cycle...");
    if (isShutdownRequested()) {
      return { stop: true };
    }
    // Perform background task
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { stop: true }; // Stop after first cycle for demo
  },
  onShutdown: async () => {
    console.log("Shutdown complete");
    await teardown.run();
  }
});
```

## Teardown Management

Use `createTeardown()` to register cleanup functions once and execute them from
every exit path.

```typescript
import { createTeardown } from "@hardlydifficult/daemon";

const teardown = createTeardown();
teardown.add(() => server.stop());
teardown.add(async () => {
  await db.close();
});
teardown.trapSignals();

await teardown.run();
```

### Behavior

- **LIFO execution**: last added, first run
- **Idempotent `run()`**: safe to call multiple times
- **Per-function error isolation**: one failing teardown does not block others
- **`add()` returns an unregister function**: allowing selective cleanup removal

### `createTeardown()`

Creates a teardown registry with idempotent resource cleanup.

```typescript
const teardown = createTeardown();

// Register cleanup functions
const unregister = teardown.add(() => server.stop());
teardown.add(async () => db.close());

// Unregister a specific cleanup
unregister();

// Manually trigger shutdown
await teardown.run();

// Wire SIGTERM/SIGINT handlers
const untrap = teardown.trapSignals();
// Later...
untrap(); // Remove handlers
```

#### Teardown API

| Method | Description |
|--------|-----------|
| `add(fn)` | Register a cleanup function; returns an unregister function |
| `run()` | Run all teardown functions in LIFO order (idempotent) |
| `trapSignals()` | Wire SIGINT/SIGTERM to `run()` then `process.exit(0)`; returns untrap function |

### LIFO Execution

Teardown functions run in reverse registration order:

```typescript
const teardown = createTeardown();
teardown.add(() => console.log("First"));
teardown.add(() => console.log("Second"));
teardown.add(() => console.log("Third"));

await teardown.run();
// Output:
// Third
// Second
// First
```

## Continuous Loop Execution

Use `runContinuousLoop()` to run work cycles with graceful shutdown, dynamic
delay control, and configurable error policy.

```typescript
import { runContinuousLoop } from "@hardlydifficult/daemon";

await runContinuousLoop({
  intervalSeconds: 30,
  async runCycle(isShutdownRequested) {
    if (isShutdownRequested()) {
      return { stop: true };
    }

    const didWork = await syncQueue();
    if (!didWork) {
      return 60_000; // ms
    }

    return "immediate";
  },
  onCycleError(error, context) {
    notifyOps(error, { cycleNumber: context.cycleNumber });
    return "continue"; // or "stop"
  },
});
```

### Cycle Return Contract

`runCycle()` can return:

- any value/`undefined`: use default `intervalSeconds`
- `number`: use that delay in milliseconds
- `"immediate"`: run the next cycle without sleeping
- `{ stop: true }`: stop gracefully after current cycle
- `{ nextDelayMs: number | "immediate", stop?: true }`: explicit control object

### Optional Delay Resolver

If your cycle returns domain data, derive schedule policy with
`getNextDelayMs(result, context)`.

### Error Handling

Use `onCycleError(error, context)` to route to Slack/Sentry and decide whether
to `"continue"` or `"stop"`. Without this hook, cycle errors are logged and the
loop continues.

### Logger Injection

By default, warnings and errors use `console.warn` and `console.error`. Pass
`logger` to integrate your own logging implementation:

```typescript
const logger = {
  warn: (message, context) => myLogger.warn(message, context),
  error: (message, context) => myLogger.error(message, context),
};
```

### `runContinuousLoop()` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `intervalSeconds` | `number` | — | Interval between cycles in seconds |
| `runCycle` | `Function` | — | Callback for each cycle |
| `getNextDelayMs?` | `Function` | — | Derive delay from cycle result |
| `onCycleError?` | `Function` | — | Handle cycle errors |
| `onShutdown?` | `Function` | — | Cleanup on shutdown |
| `logger?` | `ContinuousLoopLogger` | `console` | Logger for warnings/errors |

### `ContinuousLoopRunCycleResult`

The return type supports:
- Raw delay (`number` or `"immediate"`)
- Control object: `{ stop?: boolean; nextDelayMs?: ContinuousLoopDelay }`

**Example:**

```typescript
async runCycle() {
  // Return raw delay
  return 5000;
  
  // Or return control directives
  return { nextDelayMs: "immediate", stop: false };
}
```

### `ContinuousLoopDelay`

```typescript
type ContinuousLoopDelay = number | "immediate"
```

### `ContinuousLoopCycleControl`

```typescript
interface ContinuousLoopCycleControl {
  stop?: boolean;
  nextDelayMs?: ContinuousLoopDelay;
}
```

### `ContinuousLoopCycleContext`

Provides context to cycle and delay resolver functions.

```typescript
interface ContinuousLoopCycleContext {
  cycleNumber: number;
  isShutdownRequested: () => boolean;
}
```

### `ContinuousLoopErrorContext`

Same as `ContinuousLoopCycleContext`.

### `ContinuousLoopErrorHandler`

Handles errors and returns `"stop"` or `"continue"`.

**Signature:**

```typescript
type ContinuousLoopErrorHandler = (
  error: unknown,
  context: ContinuousLoopErrorContext
) => ContinuousLoopErrorAction | Promise<ContinuousLoopErrorAction>
```

**Example:**

```typescript
onCycleError: async (error, context) => {
  console.error(`Cycle ${context.cycleNumber} failed: ${error.message}`);
  return "stop"; // or "continue"
}
```

### `ContinuousLoopErrorAction`

```typescript
type ContinuousLoopErrorAction = "continue" | "stop"
```

### `ContinuousLoopLogger`

```typescript
interface ContinuousLoopLogger {
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}
```

**Example:**

```typescript
const logger = {
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

await runContinuousLoop({
  intervalSeconds: 10,
  runCycle: () => Promise.resolve(),
  logger
});
```

## Shutdown

Signal handlers are automatically registered for `SIGINT` and `SIGTERM`, and removed on completion.

```typescript
const loopPromise = runContinuousLoop({
  intervalSeconds: 1,
  runCycle: async (isShutdownRequested) => {
    while (!isShutdownRequested()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  },
  onShutdown: async () => {
    await db.close();
  },
});

// Later...
process.kill(process.pid, "SIGTERM"); // Triggers graceful shutdown
await loopPromise; // Resolves after onShutdown completes
```