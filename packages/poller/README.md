# @hardlydifficult/poller

A generic polling utility that periodically fetches data, detects changes via deep equality comparison, and supports debounced manual triggers with overlap handling.

## Installation

```bash
npm install @hardlydifficult/poller
```

## Quick Start

```typescript
import { Poller } from "@hardlydifficult/poller";

const poller = new Poller(
  async () => {
    const res = await fetch("https://api.example.com/status");
    return res.json();
  },
  (current, previous) => {
    console.log("Status changed:", current);
  },
  5000 // poll every 5 seconds
);

await poller.start();
// Polls start immediately

// Optionally, manually trigger a debounced poll
poller.trigger(1000); // fires once after 1s of inactivity

// Stop polling when done
poller.stop();
```

### Basic Usage

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

## Polling Behavior

The `Poller` executes a fetch function at a fixed interval and invokes a callback only when the returned value changes.

- Starts polling immediately on `start()`
- Fetches at the configured `intervalMs`
- Skips overlapping fetches (if a previous fetch is still in progress)

```typescript
const poller = new Poller(
  async () => fetchJson("/api/data"),
  (current, previous) => console.log("Changed:", current),
  10_000
);
await poller.start();
```

## Change Detection

Changes are detected using deep equality via `JSON.stringify`. Structural equality means that objects with identical content—even different references—won’t trigger unnecessary callbacks.

```typescript
const poller = new Poller(
  async () => ({ items: [1, 2, 3] }),
  (current, previous) => console.log("Changed:", current),
  1000
);

// Even if a new object instance is returned, same structure = no change
await poller.start();
// onChange fires only when structure changes
```

- On first poll, `onChange(current, undefined)` is invoked.
- On subsequent polls, `onChange(current, previous)` is invoked only if the new value differs structurally.

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

## Lifecycle Management

Polling can be started and stopped at any time. The `stop()` method cancels both the periodic timer and any pending debounced triggers.

```typescript
await poller.start();  // begins polling
poller.stop();         // cancels all timers, stops future polls
```

### `start()`

Starts polling. Fetches immediately, then at the configured interval. Calling `start()` multiple times is safe (idempotent).

```typescript
await poller.start(); // Fetches immediately
await poller.start(); // No-op, already running
```

### `stop()`

Stops polling and cleans up all timers.

```typescript
poller.stop();
// No more polls will fire
```

## Manual Triggers

You can manually trigger a debounced poll to force an immediate check after a period of inactivity.

| Parameter   | Type     | Default | Description                            |
|-------------|----------|---------|----------------------------------------|
| `debounceMs`| `number` | `1000`  | Milliseconds to wait before polling    |

```typescript
// Immediate trigger with default debounce
poller.trigger();

// Custom debounce
poller.trigger(500);

// If multiple triggers occur within debounceMs, only the last one fires
poller.trigger();
poller.trigger();
poller.trigger(); // only this one will poll after 1s
```

### Behavior

- Accepts a `debounceMs` parameter (default: `1000`).
- Multiple rapid calls reset the debounce timer — only the last trigger fires.
- No-op if the poller is not running.

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

Fetch errors do not halt polling. An optional `onError` callback receives any errors, and polling continues at the next interval.

```typescript
const poller = new Poller(
  async () => {
    if (Math.random() < 0.5) throw new Error("Network fail");
    return "ok";
  },
  (current) => console.log(current),
  1000,
  (error) => console.error("Fetch failed:", error)
);

await poller.start();
// Continues polling even after errors
```

### Error Handling Details

- Errors during fetch are caught and passed to the optional `onError` callback.
- Polling continues after errors — no automatic retry logic is applied.

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

## Core Features

### Polling Lifecycle

The `Poller` manages its lifecycle with `start()` and `stop()` methods.

- `start()`: Begins polling immediately and then at the configured interval. Idempotent — calling it multiple times has no effect after the first call.
- `stop()`: Clears the polling timer and any pending debounced triggers. No-op if already stopped.

### Concurrent Fetch Handling

Overlapping fetches (e.g., due to slow network) are automatically skipped:
- If `poll()` is already running when the interval fires, the next poll is skipped until the current one completes.

## API Reference

### `Poller<T>` Constructor

| Parameter   | Type                                  | Description                              |
|-------------|---------------------------------------|------------------------------------------|
| `fetchFn`   | `() => Promise<T>`                    | Async function returning the current state |
| `onChange`  | `(current: T, previous: T | undefined) => void` | Callback invoked on state changes        |
| `intervalMs`| `number`                              | Polling interval in milliseconds         |
| `onError?`  | `(error: unknown) => void`            | Optional callback for fetch errors       |

### Methods

| Method       | Signature                              | Description                                  |
|--------------|----------------------------------------|----------------------------------------------|
| `start()`    | `(): Promise<void>`                    | Begins polling (immediate + interval-based) |
| `stop()`     | `(): void`                             | Stops polling and clears timers              |
| `trigger()`  | `(debounceMs?: number) => void`        | Triggers a debounced manual poll             |

### Behavior

- **Deep equality** — uses JSON serialization to detect structural changes
- **Overlap prevention** — skips a poll if the previous fetch is still running
- **Error resilience** — continues polling after fetch errors
- **Idempotent start** — calling `start()` multiple times is safe
- **Debounced triggers** — multiple `trigger()` calls coalesce into one poll