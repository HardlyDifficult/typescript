I'll inspect the source files to understand the API and generate an accurate README.Now I have all the information needed to generate a comprehensive README. Let me create it:

# @hardlydifficult/teardown

Idempotent resource cleanup with signal trapping. Register cleanup functions once at resource creation time — all exit paths call a single `run()`.

## Install

```bash
npm install @hardlydifficult/teardown
```

## Usage

```typescript
import { createTeardown } from "@hardlydifficult/teardown";

const teardown = createTeardown();
teardown.add(() => server.stop());
teardown.add(() => db.close());
teardown.trapSignals();

// Any manual exit path:
await teardown.run();
```

## API

### `createTeardown(): Teardown`

Creates a new teardown registry for managing cleanup operations.

```typescript
import { createTeardown } from "@hardlydifficult/teardown";

const teardown = createTeardown();
```

### `Teardown.add(fn)`

Register a teardown function. Returns an unregister function that removes this specific registration.

**Signature:**
```typescript
add(fn: () => void | Promise<void>): () => void
```

**Parameters:**
- `fn` — A synchronous or asynchronous cleanup function

**Returns:** An unregister function that safely removes this registration

**Example:**
```typescript
import { createTeardown } from "@hardlydifficult/teardown";

const teardown = createTeardown();

// Register cleanup functions
teardown.add(() => console.log("Cleanup 1"));
teardown.add(async () => {
  await db.close();
  console.log("Cleanup 2");
});

// Unregister a specific function
const unregister = teardown.add(() => console.log("Cleanup 3"));
unregister(); // Cleanup 3 will not run

await teardown.run();
// Output:
// Cleanup 2
// Cleanup 1
```

### `Teardown.run(): Promise<void>`

Run all registered teardown functions in LIFO (last-in-first-out) order. Idempotent — subsequent calls are no-ops.

**Signature:**
```typescript
run(): Promise<void>
```

**Example:**
```typescript
import { createTeardown } from "@hardlydifficult/teardown";

const teardown = createTeardown();
const order: number[] = [];

teardown.add(() => order.push(1));
teardown.add(() => order.push(2));
teardown.add(() => order.push(3));

await teardown.run();
console.log(order); // [3, 2, 1]

// Second call is a no-op
await teardown.run();
console.log(order); // [3, 2, 1] — unchanged
```

### `Teardown.trapSignals(): () => void`

Wire SIGTERM and SIGINT signals to automatically call `run()` then `process.exit(0)`. Returns an untrap function to remove signal handlers.

**Signature:**
```typescript
trapSignals(): () => void
```

**Returns:** An untrap function that removes the signal handlers

**Example:**
```typescript
import { createTeardown } from "@hardlydifficult/teardown";

const teardown = createTeardown();

teardown.add(() => {
  console.log("Cleaning up...");
});

// Trap SIGTERM and SIGINT
const untrap = teardown.trapSignals();

// Send SIGTERM to process — cleanup runs automatically
// process.kill(process.pid, "SIGTERM");

// Later, if needed, remove signal handlers
untrap();
```

## Behavior

| Feature | Description |
|---------|-------------|
| **LIFO order** | Teardowns run in reverse registration order (last added runs first) |
| **Idempotent** | `run()` executes once; subsequent calls are no-ops |
| **Error resilient** | Each function is wrapped in try/catch; failures don't block remaining teardowns |
| **Safe unregister** | `add()` returns an unregister function; safe to call multiple times |
| **Post-run add** | `add()` after `run()` is a silent no-op; returned unregister is safe to call |
| **Duplicate safe** | Same function added twice runs twice; unregister only removes its own registration |
| **Async support** | Teardown functions can be synchronous or asynchronous; `run()` waits for all to complete |