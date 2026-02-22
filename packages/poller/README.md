# @hardlydifficult/poller

Lightweight polling utility with debounced triggers, overlapping request handling, and deep equality change detection.

## Installation

```bash
npm install @hardlydifficult/poller
```

## Quick Start

```typescript
import { Poller } from "@hardlydifficult/poller";

const fetchFn = async () => {
  const response = await fetch("https://api.example.com/status");
  return response.json();
};

const poller = new Poller(
  fetchFn,
  (data, prev) => console.log("Data changed:", data),
  5000 // 5-second interval
);

await poller.start();
// Polls every 5 seconds and logs only when data changes

// Later, stop polling
poller.stop();
```

## Polling with Change Detection

The `Poller` class polls a fetch function periodically and invokes a callback only when the result changes. Change detection uses deep equality via `JSON.stringify` comparison, ensuring that structurally identical values (even with different object references) do not trigger redundant callbacks.

### Constructor Parameters

| Parameter   | Type                                | Description                                         |
|-------------|-------------------------------------|-----------------------------------------------------|
| `fetchFn`   | `() => Promise<T>`                  | Async function that returns the data to poll        |
| `onChange`  | `(current: T, previous: T | undefined) => void` | Callback invoked when data changes                  |
| `intervalMs`| `number`                            | Polling interval in milliseconds                    |
| `onError?`  | `(error: unknown) => void` (optional) | Optional error handler for fetch failures          |

### Poller API

```typescript
// Start polling (idempotent — safe to call multiple times)
await poller.start();

// Stop polling and clear timers
poller.stop();

// Manually trigger a poll (debounced by default)
poller.trigger(1000); // Debounced 1s (default 1000ms)
```

### Debounced Manual Trigger

The `trigger()` method allows manually forcing a poll while debouncing multiple rapid calls:

```typescript
await poller.start();
poller.trigger(500); // Schedules a poll after 500ms
poller.trigger(500); // Resets debounce — only one poll fires
```

### Error Handling

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
const fetchFn = vi.fn().mockImplementation(() => {
  // Simulates slow network — never resolves before interval
  return new Promise((resolve) => setTimeout(() => resolve("data"), 6000));
});
const poller = new Poller(fetchFn, () => {}, 1000);
await poller.start();
// Only one fetch runs at a time — subsequent intervals are skipped until it completes
```