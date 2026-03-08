# @hardlydifficult/throttle

Opinionated helpers for rate-limited work, retries, backoff, and event-driven request flows.

The package now prefers task-oriented APIs:

- Throttles should run the work for you.
- Retries should own the sleep/backoff path for you.
- Low-level primitives still exist, but they are the escape hatch.

## Installation

```bash
npm install @hardlydifficult/throttle
```

## Quick Start

```typescript
import {
  throttle,
  retry,
  isTransientNetworkError,
} from "@hardlydifficult/throttle";

const githubApi = throttle({ perSecond: 5 });

const pullRequests = await githubApi.run(() =>
  octokit.pulls.list({
    owner: "hardlydifficult",
    repo: "typescript",
    state: "open",
  })
);

const result = await retry(
  () => fetch("https://api.example.com/data"),
  {
    attempts: 3,
    backoff: true,
    when: isTransientNetworkError,
  }
);
```

## Throttling

### `throttle(options)`

Creates a `Throttle` instance with a clean, task-oriented API.

```typescript
import { throttle } from "@hardlydifficult/throttle";

const githubApi = throttle({
  perSecond: 5,
  onDelay(delayMs, info) {
    console.log(`Waiting ${delayMs}ms before ${info.weight} units`);
  },
});

const response = await githubApi.run(
  () =>
    octokit.checks.listForRef({
      owner,
      repo,
      ref: sha,
    }),
  1
);
```

### `new Throttle(options)`

Still available when you want the class directly.

### `ThrottleOptions`

| Field | Type | Description |
|-------|------|-------------|
| `perSecond` | `number` | Maximum throughput |
| `name?` | `string` | Persistence key when sharing throttle state across restarts |
| `stateDirectory?` | `string` | Directory for persisted state |
| `storageAdapter?` | `StorageAdapter` | Custom persistence adapter |
| `onDelay?` | `(delayMs, info) => void` | Called before the throttle sleeps |

### `Throttle` methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `run` | `<T>(task: () => Promise<T> \| T, weight?: number) => Promise<T>` | Waits, then executes the task |
| `wait` | `(weight?: number) => Promise<void>` | Low-level primitive when you need to separate waiting from the work |

### `ThrottleDelayInfo`

| Field | Type | Description |
|-------|------|-------------|
| `weight` | `number` | Units charged for the task |
| `perSecond` | `number` | Configured rate limit |
| `scheduledStart` | `number` | Timestamp when the task was scheduled to start |

## Retry

`retry` is now meant to be the main entry point. It supports fixed delays, exponential backoff, and retry predicates without forcing callers to wire `sleep()` manually.

```typescript
import { retry, isTransientNetworkError } from "@hardlydifficult/throttle";

const response = await retry(
  () => fetch("https://api.example.com/data"),
  {
    attempts: 4,
    backoff: { initialDelayMs: 250, maxDelayMs: 4_000 },
    when: isTransientNetworkError,
    onRetry(error, info) {
      console.log(
        `Attempt ${info.attempt} failed: ${error.message}. Retrying in ${info.delayMs}ms.`
      );
    },
  }
);
```

### `RetryOptions`

| Field | Type | Description |
|-------|------|-------------|
| `attempts` | `number` | Total attempts, including the first call |
| `backoff?` | `true \| number \| BackoffOptions` | `true` for default exponential backoff, a number for fixed delay, or custom backoff options |
| `when?` | `(error, attempt) => boolean \| Promise<boolean>` | Return `false` to stop retrying |
| `onRetry?` | `(error, info) => void \| Promise<void>` | Runs before the retry sleep |

### `RetryInfo`

| Field | Type | Description |
|-------|------|-------------|
| `attempt` | `number` | 1-based attempt that failed |
| `attempts` | `number` | Total configured attempts |
| `delayMs` | `number` | Delay before the next attempt |
| `retriesLeft` | `number` | Remaining attempts after the current failure |

## Backoff Utilities

Low-level helpers are still exported when you need them.

```typescript
import {
  getBackoffDelay,
  getRandomDelay,
  sleep,
} from "@hardlydifficult/throttle";

const delay = getBackoffDelay(2, {
  initialDelayMs: 500,
  maxDelayMs: 30_000,
});

await sleep(delay);
const jitter = getRandomDelay(500, 1_000);
```

## Throttled Updates

Use `createThrottledUpdater` when you want rapid updates to collapse into the latest value.

```typescript
import { createThrottledUpdater } from "@hardlydifficult/throttle";

const updater = createThrottledUpdater(
  async (text) => {
    await message.edit(text);
  },
  1_000
);

updater.update("Step 1...");
updater.update("Step 2...");
updater.update("Step 3...");

await updater.flush();
updater.stop();
```

## Event-Driven Requests

`eventRequest` wraps subscribe/filter/cleanup request flows in a single promise.

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
```

## Error Detection

```typescript
import {
  isConnectionError,
  isTransientNetworkError,
} from "@hardlydifficult/throttle";

if (isConnectionError(error)) {
  console.error("The service is unavailable.");
}

if (isTransientNetworkError(error)) {
  console.error("This request is worth retrying.");
}
```
