# @hardlydifficult/throttle

A TypeScript utility package providing rate limiting, exponential backoff, connection error detection, and throttled update batching.

## Installation

```bash
npm install @hardlydifficult/throttle
```

## Quick Start

```typescript
import { Throttle, getBackoffDelay, sleep, retry, createThrottledUpdater, isConnectionError } from "@hardlydifficult/throttle";

// Rate limit function calls to 10 per second
const throttle = new Throttle({ unitsPerSecond: 10 });
await throttle.wait(); // Sleeps if necessary to respect limit

// Exponential backoff for retries
const delay = getBackoffDelay(2); // 4000ms (2^2 * 1000)
await sleep(delay);

// Retry a function with exponential backoff
const result = await retry(
  async () => { throw new Error("fail"); },
  { maxAttempts: 3 }
);

// Throttled message updater
const updater = createThrottledUpdater(
  (text) => console.log(text),
  1000
);
updater.update("Fast update 1");
updater.update("Fast update 2"); // Only final update is sent
await updater.flush(); // Flush pending update immediately
updater.stop();

// Detect connection errors
if (isConnectionError(error)) {
  console.log("Connection failed - restart service or retry later");
}
```

## Throttling

### Throttle Class

A rate limiter that enforces a maximum throughput by sleeping between calls, with optional persistent state.

```typescript
import { Throttle } from "@hardlydifficult/throttle";

// Create a rate limiter for 5 requests per second
const throttle = new Throttle({ unitsPerSecond: 5 });

// Wait for permission to proceed (sleeps if needed)
await throttle.wait();

// Use weight for multi-unit operations (e.g., batch size)
await throttle.wait(3); // Slower when weight > unitsPerSecond
```

#### ThrottleOptions

| Field | Type | Description |
|-------|------|-------------|
| `unitsPerSecond` | `number` | Maximum throughput (must be positive) |
| `persistKey?` | `string` | Key for state persistence (enables resume across restarts) |
| `stateDirectory?` | `string` | Directory for persisted state (default: OS temp dir) |
| `onSleep?` | `(delayMs: number, info: ThrottleSleepInfo) => void` | Callback when throttling occurs |

#### ThrottleSleepInfo

| Field | Type | Description |
|-------|------|-------------|
| `weight` | `number` | Weight of the wait call |
| `limitPerSecond` | `number` | configured `unitsPerSecond` |
| `scheduledStart` | `number` | Timestamp when sleep was scheduled |

### createThrottledUpdater

Batch rapid updates to respect rate limits while ensuring final state delivery.

```typescript
import { createThrottledUpdater } from "@hardlydifficult/throttle";

const updater = createThrottledUpdater(
  async (text) => console.log(text), // Update function
  1000 // Minimum interval between updates (ms)
);

updater.update("First update");
updater.update("Second update"); // Batches with first
updater.update("Final update");  // Replaces pending update

await updater.flush(); // Immediately send pending update
updater.stop(); // Stop future updates
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `update` | `(text: string) => void` | Queue an update (immediate if interval elapsed) |
| `flush` | `() => Promise<void>` | Immediately send any pending update |
| `stop` | `() => void` | Cancel all scheduled updates and cleanup |

## Exponential Backoff

Utilities for retry logic with exponential delay growth.

```typescript
import { getBackoffDelay, sleep, getRandomDelay } from "@hardlydifficult/throttle";

// Calculate delay: initial * 2^attempt, capped at maxDelay
const delay1 = getBackoffDelay(0); // 1000ms
const delay2 = getBackoffDelay(1); // 2000ms
const delay3 = getBackoffDelay(2); // 4000ms

// Custom options
const delayCustom = getBackoffDelay(3, {
  initialDelayMs: 500, // 500ms * 2^3 = 4000ms
  maxDelayMs: 30000    // capped to 30000ms
});

// Randomized delay for jitter
const jittered = getRandomDelay(1000, 2000); // e.g., 1473ms
```

#### BackoffOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `initialDelayMs?` | `number` | `1000` | Starting delay in ms |
| `maxDelayMs?` | `number` | `60000` | Maximum delay cap in ms |

## Retry Logic

Retry an async function with optional backoff and hooks.

```typescript
import { retry, sleep, getBackoffDelay } from "@hardlydifficult/throttle";

const result = await retry(
  async () => {
    // Your async operation
    return fetch("/api/data");
  },
  {
    maxAttempts: 3,
    onRetry: async (error, attempt) => {
      // Backoff delay between attempts (1-based)
      const delay = getBackoffDelay(attempt - 1);
      await sleep(delay);
    }
  }
);
```

#### RetryOptions

| Field | Type | Description |
|-------|------|-------------|
| `maxAttempts` | `number` | Maximum number of attempts (must be ≥ 1) |
| `onRetry?` | `(error: Error, attempt: number) => void \| Promise<void>` | Called before each retry with 1-based attempt number |

## Event-Driven Requests

Wrap event-based request/response patterns in promises.

```typescript
import { eventRequest } from "@hardlydifficult/throttle";

const result = await eventRequest({
  send: () => manager.send(workerId, { requestId, prompt }),
  match: (event) => event.requestId === requestId,
  on: {
    complete: (cb) => manager.onComplete(cb),
    error: (cb) => manager.onError(cb),
    data: (cb) => manager.onOutput(cb), // Optional streaming
  },
  onData: (output) => stream.append(output.content),
});

// subscriptions are cleaned up automatically
```

#### EventRequestOptions

| Field | Type | Description |
|-------|------|-------------|
| `send` | `() => void` | Called after subscriptions are set up to send the request |
| `match` | `(event: T) => boolean` | Predicate to filter relevant events |
| `on.complete` | `EventSubscriber<T>` | Resolves the promise with the event |
| `on.error` | `EventSubscriber<T>` | Rejects the promise with the event |
| `on.data?` | `EventSubscriber<T>` | Optional streaming data events |
| `onData?` | `(event: T) => void` | Called for each matching data event |

#### EventSubscriber

```typescript
type EventSubscriber<T> = (handler: (event: T) => void) => () => void;
```

Returns an unsubscribe function.

## Error Detection

### Connection Errors

Detect service-unreachable errors like `ECONNREFUSED`.

```typescript
import { isConnectionError } from "@hardlydifficult/throttle";

const error1 = new Error("connect ECONNREFUSED 127.0.0.1:11434");
console.log(isConnectionError(error1)); // true

const error2 = new Error("File not found");
console.log(isConnectionError(error2)); // false
```

**Detected Patterns:**
- Error message contains `"econnrefused"` or `"cannot connect to api"`
- `error.code === "ECONNREFUSED"`
- Nested errors via `cause`, `lastError`, or `errors[]` array

### Transient Network Errors

Detect temporary network failures safe to retry.

```typescript
import { isTransientNetworkError } from "@hardlydifficult/throttle";

const errors = [
  new Error("Recv failure: Connection was reset"),
  new Error("ETIMEDOUT"),
  new Error("Could not resolve host"),
];

errors.forEach(e => console.log(isTransientNetworkError(e))); // true, true, true
```