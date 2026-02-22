# @hardlydifficult/poller

A lightweight polling utility with debounced manual triggers, overlapping request handling, and deep equality change detection.

## Installation

```bash
npm install @hardlydifficult/poller
```

## Quick Start

```typescript
import { Poller } from "@hardlydifficult/poller";

const fetchUser = async () => {
  const res = await fetch("https://api.example.com/user");
  return res.json();
};

const poller = new Poller(
  fetchUser,
  (user, previousUser) => {
    console.log("User changed:", user);
  },
  5000 // Poll every 5 seconds
);

await poller.start();
// Polling begins immediately and every 5 seconds

// Optionally, manually trigger a poll with debounce
poller.trigger(1000); // Fires after 1s of inactivity

// Stop polling when no longer needed
poller.stop();
```

## Polling with Change Detection

The `Poller` class periodically fetches data using a user-provided async function and invokes a callback only when the result changes. Change detection uses deep equality via `JSON.stringify`, ensuring structurally identical values (even with different object references) do not trigger redundant callbacks.

### Constructor Parameters

| Parameter | Type | Description |
|------|--|---------|
| `fetchFn` | `() => Promise<T>` | Async function that fetches the data to poll |
| `onChange` | `(current: T, previous: T \| undefined) => void` | Callback invoked when data changes (using deep equality) |
| `intervalMs` | `number` | Polling interval in milliseconds |
| `onError?` | `(error: unknown) => void` | Optional callback for fetch errors |

### `start(): Promise<void>`

Begins polling immediately and at the configured interval.

```typescript
await poller.start();
// Polls once immediately, then every intervalMs ms
```

### `stop(): void`

Stops polling and clears any pending debounced triggers.

```typescript
poller.stop();
// No further polls occur; timers cleared
```

### `trigger(debounceMs?: number): void`

Manually trigger a poll with debouncing to avoid excessive requests during rapid events.

```typescript
// Default debounce: 1000ms
poller.trigger();

// Custom debounce
poller.trigger(2000); // Fires after 2 seconds of no other triggers
```

## Debounced Manual Trigger

The `trigger()` method allows manually forcing a poll while debouncing multiple rapid calls:

```typescript
await poller.start();
poller.trigger(500); // Schedules a poll after 500ms
poller.trigger(500); // Resets debounce — only one poll fires
```

## Error Handling

Errors during polling do not halt the poller. They are optionally reported via `onError`, if provided.

```typescript
const poller = new Poller(
  async () => {
    throw new Error("Network failure");
  },
  (data) => console.log(data),
  2000,
  (error) => console.error("Poll failed:", error)
);
await poller.start();
// Logs: Poll failed: Error: Network failure
// Continues polling after each error
```

## Overlapping Request Handling

The `Poller` skips new polls while a fetch is still in progress, preventing overlapping requests.

```typescript
const fetchFn = async () => {
  // Simulates slow network — never resolves before interval
  await new Promise((resolve) => setTimeout(resolve, 6000));
  return "data";
};
const poller = new Poller(fetchFn, () => {}, 1000);
await poller.start();
// Only one fetch runs at a time — subsequent intervals are skipped until it completes
```

## Deep Equality Detection

The `Poller` uses `JSON.stringify` to compare current and previous values, enabling detection of structural changes in objects and arrays.

```typescript
const fetchCount = async () => ({ value: 1 });
const poller = new Poller(fetchCount, (curr, prev) => {
  // Fires only when value changes
}, 1000);
```