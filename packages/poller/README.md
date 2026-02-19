# @hardlydifficult/poller

Polls an async function at a configurable interval and triggers callbacks when the result changes.

## Install

```bash
npm install @hardlydifficult/poller
```

## Quick Start

```typescript
import { Poller } from "@hardlydifficult/poller";

const poller = new Poller(
  async () => await fetchCurrentState(),
  (current, previous) => console.log("State changed!", current),
  5 * 60 * 1000 // poll every 5 minutes
);

await poller.start();

// Manual trigger with debounce (e.g. from a webhook)
poller.trigger(1000);

// Stop polling
poller.stop();
```

## Polling

The `Poller` class periodically fetches data and invokes a callback when the result changes. It fetches immediately on `start()`, then at the configured interval.

```typescript
import { Poller } from "@hardlydifficult/poller";

const poller = new Poller(
  async () => {
    const response = await fetch("/api/status");
    return response.json();
  },
  (current, previous) => {
    console.log("Previous:", previous);
    console.log("Current:", current);
  },
  10000 // poll every 10 seconds
);

await poller.start();
// Fetches immediately, then every 10 seconds
```

## Change Detection

Changes are detected using JSON serialization for deep equality. Structurally identical objects are considered unchanged, even if they are different references.

```typescript
const poller = new Poller(
  async () => ({ count: 5, items: [1, 2, 3] }),
  (current, previous) => {
    // Only fires when the JSON representation changes
    console.log("Changed from", previous, "to", current);
  },
  5000
);

await poller.start();
```

## Manual Triggers

Call `trigger()` to manually poll immediately, with optional debouncing. Multiple rapid triggers are coalesced into a single poll.

```typescript
const poller = new Poller(
  async () => await fetchData(),
  (current, previous) => console.log("Updated:", current),
  60000
);

await poller.start();

// Trigger a poll with 1000ms debounce (default)
poller.trigger();

// Trigger with custom debounce
poller.trigger(500);

// Multiple rapid triggers coalesce into one poll
poller.trigger(500);
poller.trigger(500);
poller.trigger(500); // Only one poll fires after 500ms
```

## Error Handling

Errors during fetch are passed to the optional `onError` callback. Polling continues regardless of errors.

```typescript
const poller = new Poller(
  async () => await fetchData(),
  (current, previous) => console.log("Updated:", current),
  5000,
  (error) => {
    console.error("Fetch failed:", error);
    // Polling continues automatically
  }
);

await poller.start();
```

## Lifecycle

### `start()`

Starts polling. Fetches immediately, then at the configured interval. Calling `start()` multiple times is safe (idempotent).

```typescript
const poller = new Poller(
  async () => await fetchData(),
  (current) => console.log("Updated:", current),
  5000
);

await poller.start(); // Fetches immediately
await poller.start(); // No-op, already running
```

### `stop()`

Stops polling and cleans up all timers.

```typescript
poller.stop();
// No more polls will fire
```

## API Reference

### Constructor

```typescript
new Poller<T>(
  fetchFn: () => Promise<T>,
  onChange: (current: T, previous: T | undefined) => void,
  intervalMs: number,
  onError?: (error: unknown) => void
)
```

| Parameter | Description |
|-----------|-------------|
| `fetchFn` | Async function that returns the current state |
| `onChange` | Called with `(current, previous)` when state changes |
| `intervalMs` | Polling interval in milliseconds |
| `onError` | Optional error handler; polling continues on errors |

### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start polling (fetches immediately, then at interval) |
| `stop()` | Stop polling and clean up timers |
| `trigger(debounceMs?)` | Manually trigger a poll with debounce (default 1000ms) |

### Behavior

- **Deep equality** — uses JSON serialization to detect changes
- **Overlap prevention** — skips a poll if the previous fetch is still running
- **Error resilience** — continues polling after fetch errors
- **Idempotent start** — calling `start()` multiple times is safe
- **Debounced triggers** — multiple `trigger()` calls coalesce into one poll