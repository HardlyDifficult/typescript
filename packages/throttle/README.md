# @hardlydifficult/throttle

A TypeScript utility package providing rate limiting, exponential backoff, connection error detection, and throttled update batching.

## Installation

```bash
npm install @hardlydifficult/throttle
```

## Quick Start

```typescript
import { Throttle, retry, sleep, isConnectionError } from "@hardlydifficult/throttle";

// Rate limiting
const throttle = new Throttle({ unitsPerSecond: 5 });
await throttle.wait(); // Enforces 5 requests/second throughput

// Retry with exponential backoff
const result = await retry(
  async () => {
    // Your async operation
    return fetch("https://api.example.com/data");
  },
  {
    maxAttempts: 3,
    onRetry: async (error, attempt) => {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
      await sleep(delay);
    }
  }
);

// Detect connection errors
if (isConnectionError(error)) {
  console.log("Connection failed - restart service or retry later");
}
```

## Throttle: Rate Limiting

The `Throttle` class enforces throughput limits using a token bucket algorithm. It sleeps between calls to maintain a target rate and optionally persists state across restarts.

### Example

```typescript
import { Throttle } from "@hardlydifficult/throttle";

// Create a throttle limiting to 10 operations per second
const throttle = new Throttle({ unitsPerSecond: 10 });

// Wait for permission to proceed (defaults to weight 1)
await throttle.wait();

// Use weights for variable-cost operations (e.g., batch processing)
await throttle.wait(5); // Counts as 5 units
```

### Options

| Parameter | Type | Description |
|-----------|------|-------------|
| `unitsPerSecond` | `number` | Maximum operations per second (must be > 0) |
| `persistKey` | `string?` | Optional key for persisting state to disk |
| `stateDirectory` | `string?` | Directory for state files (defaults to temp dir) |
| `onSleep` | `(delayMs: number, info: ThrottleSleepInfo) => void?` | Callback invoked before sleeping |

### ThrottleSleepInfo

| Field | Type | Description |
|-------|------|-------------|
| `weight` | `number` | Weight passed to `wait()` |
| `limitPerSecond` | `number` | The configured `unitsPerSecond` |
| `scheduledStart` | `number` | Timestamp (ms) when sleep started |

## ThrottledUpdater: Batching Updates

The `createThrottledUpdater` function batches rapid updates to a target function while guaranteeing final state delivery. Ideal for UI updates, streaming responses, and rate-limited APIs.

### Example

```typescript
import { createThrottledUpdater } from "@hardlydifficult/throttle";

const updater = createThrottledUpdater(
  async (text) => message.edit(text),
  2000 // Minimum 2 seconds between edits
);

// Rapid updates batched to final state
updater.update("Step 1...");
updater.update("Step 2...");
updater.update("Step 3...");

// Ensure final state is sent
await updater.flush();
updater.stop(); // Clean up
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `update` | `(text: string) => void` | Queue an update (immediate if interval elapsed) |
| `flush` | `() => Promise<void>` | Immediately send any pending update |
| `stop` | `() => void` | Cancel all scheduled updates and cleanup |

## Retry: Async Function Retry

The `retry` function executes an async operation up to `maxAttempts` times, calling an optional callback before each retry. No built-in delay—use `sleep()` with backoff helpers.

### Example

```typescript
import { retry, getBackoffDelay, sleep } from "@hardlydifficult/throttle";

const result = await retry(
  async () => {
    const res = await fetch("https://api.example.com/data");
    if (!res.ok) throw new Error("HTTP error");
    return res.json();
  },
  {
    maxAttempts: 3,
    onRetry: async (error, attempt) => {
      console.warn(`Attempt ${attempt} failed: ${error.message}`);
      const delay = getBackoffDelay(attempt, { initialDelayMs: 500 });
      await sleep(delay);
    }
  }
);
```

### Options

| Field | Type | Description |
|-------|------|-------------|
| `maxAttempts` | `number` | Maximum attempts (must be ≥ 1) |
| `onRetry` | `(error: Error, attempt: number) => void \| Promise<void>?` | Called before retry (after failed attempt) |

## Exponential Backoff

The `backoff` module provides utilities for calculating and applying exponential delays.

### Functions

```typescript
import {
  getBackoffDelay,
  sleep,
  getRandomDelay
} from "@hardlydifficult/throttle";

// Calculate delay (base 1000ms, cap 60000ms by default)
const delay = getBackoffDelay(3); // Returns 8000 (1000 * 2^3)

// Custom options
const delay2 = getBackoffDelay(5, {
  initialDelayMs: 200,
  maxDelayMs: 5000
}); // Returns 5000 (capped)

// Random delay for jitter
const jitter = getRandomDelay(100, 500); // Random int [100, 500]

// Sleep
await sleep(1000);
```

### BackoffOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `initialDelayMs` | `number?` | `1000` | Starting delay in ms |
| `maxDelayMs` | `number?` | `60000` | Maximum cap in ms |

## Event Request: Event-Driven Promises

The `eventRequest` function converts event-based APIs into Promise-based patterns, ensuring race-condition-free setup.

### Example

```typescript
import { eventRequest } from "@hardlydifficult/throttle";

const result = await eventRequest({
  send: () => manager.send(workerId, { requestId, prompt }),
  match: (event) => event.requestId === requestId,
  on: {
    complete: (cb) => manager.onComplete(cb),
    error: (cb) => manager.onError(cb),
    data: (cb) => manager.onOutput(cb),
  },
  onData: (output) => stream.append(output.content),
});

// subscriptions are cleaned up automatically
```

### EventRequestOptions

| Field | Type | Description |
|-------|------|-------------|
| `send` | `() => void` | Invoked after subscriptions are set up |
| `match` | `(event: TComplete \| TError \| TData) => boolean` | Filters events |
| `on.complete` | `EventSubscriber<TComplete>` | Resolves the promise |
| `on.error` | `EventSubscriber<TError>` | Rejects the promise |
| `on.data?` | `EventSubscriber<TData>` | Optional streaming events |
| `onData?` | `(event: TData) => void` | Callback for each data event |

### EventSubscriber

```typescript
type EventSubscriber<T> = (handler: (event: T) => void) => () => void;
```

Returns an unsubscribe function.

## Connection Error Detection

The `isConnectionError` utility checks whether an error indicates a network connectivity failure.

### Example

```typescript
import { isConnectionError } from "@hardlydifficult/throttle";

try {
  await doNetworkRequest();
} catch (error) {
  if (isConnectionError(error)) {
    console.error("Service unreachable - check network or service status");
  } else {
    throw error;
  }
}
```

### Detected Patterns

- Error message contains `"econnrefused"` or `"cannot connect to api"`
- `error.code === "ECONNREFUSED"`
- Nested errors via `cause`, `lastError`, or `errors[]` array

## API Reference

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `Throttle` | `class` | Rate limiter with optional persistence |
| `ThrottleOptions` | `interface` | Constructor options for Throttle |
| `ThrottleSleepInfo` | `interface` | Info passed to `onSleep` callback |
| `createThrottledUpdater` | `function` | Create a throttled updater |
| `ThrottledUpdater` | `interface` | Updater instance API |
| `getBackoffDelay` | `function` | Calculate exponential backoff delay |
| `sleep` | `function` | Promise-based sleep |
| `getRandomDelay` | `function` | Random delay between min and max |
| `BackoffOptions` | `interface` | Backoff configuration |
| `isConnectionError` | `function` | Detect connection-related errors |
| `eventRequest` | `function` | Promise wrapper for event patterns |
| `EventRequestOptions` | `interface` | Options for eventRequest |
| `EventSubscriber` | `type` | Subscription function type |
| `retry` | `function` | Retry async function |
| `RetryOptions` | `interface` | Options for retry |