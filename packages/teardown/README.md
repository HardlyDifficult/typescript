# @hardlydifficult/teardown

Idempotent resource teardown with signal trapping. Register cleanup functions once at resource creation time — all exit paths call a single `run()`.

## Installation

```bash
npm install @hardlydifficult/teardown
```

## Quick Start

```typescript
import { createTeardown } from "@hardlydifficult/teardown";

const teardown = createTeardown();
teardown.add(() => server.stop());
teardown.add(() => db.close());
teardown.trapSignals();

// Any manual exit path:
await teardown.run();
```

## Creating a Teardown Registry

Use `createTeardown()` to create a new teardown registry that manages cleanup functions.

```typescript
import { createTeardown } from "@hardlydifficult/teardown";

const teardown = createTeardown();
```

## Registering Cleanup Functions

Call `add()` to register a cleanup function. Functions run in LIFO order (last added runs first). The `add()` method returns an unregister function for selective cleanup.

```typescript
const teardown = createTeardown();

// Register sync cleanup
teardown.add(() => {
  console.log("Closing server");
  server.stop();
});

// Register async cleanup
teardown.add(async () => {
  console.log("Closing database");
  await db.close();
});

// Unregister a specific function
const unregister = teardown.add(() => {
  console.log("This won't run");
});
unregister();

await teardown.run();
// Output:
// Closing database
// Closing server
```

## Running Teardown

Call `run()` to execute all registered cleanup functions in LIFO order. The method is idempotent — subsequent calls are no-ops.

```typescript
const teardown = createTeardown();
teardown.add(() => console.log("cleanup"));

await teardown.run();
// Output: cleanup

await teardown.run();
// No output (idempotent)
```

## Signal Trapping

Call `trapSignals()` to automatically run teardown when the process receives SIGTERM or SIGINT signals. Returns an untrap function to remove signal handlers.

```typescript
const teardown = createTeardown();
teardown.add(() => server.stop());

// Wire SIGTERM/SIGINT to run() then process.exit(0)
const untrap = teardown.trapSignals();

// Later, if needed:
untrap();
```

## Error Resilience

Each teardown function is wrapped in try/catch. Errors don't block remaining teardowns — all functions run regardless of failures.

```typescript
const teardown = createTeardown();

teardown.add(() => {
  throw new Error("First cleanup fails");
});
teardown.add(() => {
  console.log("Second cleanup still runs");
});

await teardown.run();
// Output: Second cleanup still runs
```

## Behavior Reference

| Behavior | Details |
|----------|---------|
| **LIFO order** | Teardowns run in reverse registration order (last added runs first) |
| **Idempotent** | `run()` executes once; subsequent calls are no-ops |
| **Error resilient** | Each function is wrapped in try/catch; failures don't block remaining teardowns |
| **Safe unregister** | `add()` returns an unregister function; safe to call multiple times |
| **Post-run add** | `add()` after `run()` is a silent no-op |
| **Duplicate safe** | Same function added twice runs twice; unregister only removes its own registration |