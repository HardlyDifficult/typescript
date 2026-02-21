# @hardlydifficult/poller

A lightweight polling utility with debounced triggers, overlapping request handling, and deep equality change detection.

## Installation

```bash
npm install @hardlydifficult/poller
```

## Quick Start

```typescript
import { Poller } from "@hardlydifficult/poller";

const fetchFn = async () => {
  const response = await fetch("https://api.example.com/data");
  return response.json();
};

const onChange = (current: unknown, previous: unknown) => {
  console.log("Data changed:", current);
};

const poller = new Poller(fetchFn, onChange, 5000);

await poller.start();
// => Starts polling every 5 seconds, firing onChange on first fetch and any change

poller.trigger(1000);
// => Triggers a debounced poll after 1 second (overriding any previous trigger call)
```

## Poller Class

A generic polling utility that periodically fetches data and invokes a callback when the result changes.

### Constructor

| Parameter    | Type                              | Description                                  |
|--------------|-----------------------------------|----------------------------------------------|
| `fetchFn`    | `() => Promise<T>`                | Async function that fetches the latest data  |
| `onChange`   | `(current: T, previous: T | undefined) => void` | Callback invoked when data changes         |
| `intervalMs` | `number`                          | Polling interval in milliseconds             |
| `onError?`   | `(error: unknown) => void`        | Optional callback invoked on fetch errors    |

### Methods

#### `start(): Promise<void>`

Starts polling at the configured interval. Does nothing if already running.

```typescript
await poller.start();
// => Begins polling; invokes onChange immediately on first fetch
```

#### `stop(): void`

Stops polling and clears all timers (including any pending debounced trigger).

```typescript
poller.stop();
// => Immediately halts polling and cancels pending triggers
```

#### `trigger(debounceMs = 1000): void`

Triggers a debounced poll. Multiple rapid calls reset the debounce timer.

```typescript
poller.trigger(500); // Debounce: 500 ms
poller.trigger(200); // Resets to 200 ms from now
// Only one poll fires after the last trigger delay
```

### Behavior

- **Deep equality detection**: Uses `JSON.stringify` to detect structural changes, even with new object references.
- **Overlapping request handling**: Skips polls while a fetch is in progress.
- **Error resilience**: Continues polling on errors if `onError` is provided; otherwise, errors are silently ignored.

```typescript
const poller = new Poller(
  async () => fetch("https://api.example.com/status").then(r => r.json()),
  (current, previous) => console.log("Status changed:", current),
  10000, // 10 seconds
  (error) => console.error("Polling error:", error)
);

await poller.start();
poller.trigger(500); // Manual override after 0.5s if triggered again
```