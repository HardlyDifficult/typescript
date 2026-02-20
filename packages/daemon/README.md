# @hardlydifficult/daemon

Opinionated utilities for long-running Node.js services:

- `createTeardown()` for idempotent cleanup with signal trapping
- `runContinuousLoop()` for daemon-style cycle execution

## Installation

```bash
npm install @hardlydifficult/daemon
```

## Quick Start

```typescript
import { createTeardown, runContinuousLoop } from "@hardlydifficult/daemon";

// Graceful shutdown with LIFO cleanup
const teardown = createTeardown();
teardown.add(() => console.log("Cleaning up server"));
teardown.add(() => console.log("Closing database connection"));
teardown.trapSignals();

// Continuous background task with signal-aware sleep
await runContinuousLoop({
  intervalSeconds: 5,
  runCycle: async (isShutdownRequested) => {
    console.log("Running task...");
    if (isShutdownRequested()) {
      return { stop: true };
    }
    // Perform background work
    return "immediate"; // Run next cycle immediately
  },
  onShutdown: async () => {
    await teardown.run();
  },
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

| Option | Type | Description |
|--------|------|-------------|
| `intervalSeconds` | `number` | Base interval between cycles (converted to ms) |
| `runCycle` | `(isShutdownRequested: () => boolean) => Promise<...>` | Cycle function with shutdown check |
| `getNextDelayMs?` | `(...)` => `ContinuousLoopDelay \| undefined` | Derive delay from cycle result |
| `onCycleError?` | `ContinuousLoopErrorHandler` | Handle cycle errors, return `"continue"` or `"stop"` |
| `onShutdown?` | `() => void \| Promise<void>` | Cleanup called after shutdown completes |
| `logger?` | `ContinuousLoopLogger` | Custom logger (defaults to `console`) |

### Return Values

The `runCycle` function can return:
- A delay value (`number` ms or `"immediate"`)
- `{ stop: true }` to gracefully terminate
- `{ nextDelayMs: ... }` to override delay

```typescript
await runContinuousLoop({
  intervalSeconds: 5,
  runCycle: async () => {
    const data = await fetchData();
    if (!data) {
      return { nextDelayMs: "immediate" }; // Retry immediately
    }
    if (data.done) {
      return { stop: true }; // End loop
    }
    return 2000; // Wait 2 seconds
  },
});
```

#### Delay Directives

| Directive | Description |
|----------|-------------|
| `number` | Milliseconds to wait before next cycle |
| `"immediate"` | Run next cycle without delay |
| `{ stop: true }` | Stop the loop after current cycle |
| `{ nextDelayMs: ... }` | Override default or derived delay |

### Error Handling Example

Cycles errors are caught and handled according to the error policy.

```typescript
await runContinuousLoop({
  intervalSeconds: 1,
  runCycle: async () => {
    if (Math.random() > 0.8) {
      throw new Error("Network failure");
    }
  },
  onCycleError: async (error, context) => {
    console.error(`Cycle ${context.cycleNumber} failed:`, error.message);
    return "continue"; // Keep the loop running
  },
  logger: {
    warn: (msg, ctx) => console.log(`[WARN] ${msg}`, ctx),
    error: (msg, ctx) => console.error(`[ERROR] ${msg}`, ctx),
  },
});
```

If no `onCycleError` is provided, errors are logged and the loop continues.

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