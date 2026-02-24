# @hardlydifficult/poller

A generic polling utility with debounced triggers, overlapping request handling, and deep equality change detection.

## Installation

```bash
npm install @hardlydifficult/poller
```

## Quick Start

```typescript
import { Poller } from "@hardlydifficult/poller";

const poller = Poller.create({
  fetch: async () => {
    const res = await fetch("https://api.example.com/user");
    return res.json();
  },
  onChange: (user, previousUser) => {
    console.log("User changed:", user, previousUser);
  },
  intervalMs: 5000,
});

await poller.start();
poller.trigger();
poller.stop();
```

## Poller Creation

The `Poller` class supports two constructor styles: a modern options-based approach and a deprecated positional constructor for backward compatibility.

### Options-based constructor (recommended)

```typescript
import { Poller } from "@hardlydifficult/poller";

const poller = Poller.create({
  fetch: async () => fetch("/api/data").then(r => r.json()),
  onChange: (current, previous) => console.log("Changed:", current),
  intervalMs: 3000,
  debounceMs: 1000, // optional, defaults to 1000
  onError: (error) => console.error("Poll error:", error), // optional
  comparator: (curr, prev) => curr.id === prev?.id, // optional
});
```

| Option | Type | Description |
|--------|------|-------------|
| `fetch` | `() => Promise<T>` | Async function to fetch data |
| `onChange` | `(current: T, previous: T \| undefined) => void` | Callback when data changes |
| `intervalMs` | `number` | Polling interval in milliseconds |
| `debounceMs` | `number` | Debounce delay for manual triggers (default: `1000`) |
| `onError` | `(error: unknown) => void` | Error handler (optional) |
| `comparator` | `(current: T, previous: T \| undefined) => boolean` | Custom change detection (default: deep equality) |

### Deprecated positional constructor

```typescript
const poller = new Poller(
  async () => fetch("/api/data").then(r => r.json()),
  (current, previous) => console.log("Changed:", current),
  3000,
  (error) => console.error("Poll error:", error)
);
```

> Note: This style is deprecated; use `Poller.create(options)` or `new Poller(options)` instead.

## Polling Control

### `start()`
Starts polling at the configured interval. Returns immediately after the first fetch completes.

```typescript
await poller.start();
```

### `stop()`
Stops all timers and prevents further polling.

```typescript
poller.stop();
```

### `trigger(debounceMs?)`
Manually triggers a poll, debouncing multiple calls.

```typescript
poller.trigger();           // Uses default debounceMs
poller.trigger(2000);       // Override debounce delay
```

## Change Detection

By default, the `Poller` uses deep equality to detect changes, supporting primitives, arrays, and plain objects—even when new references are returned.

```typescript
const poller = Poller.create({
  fetch: async () => ({ count: 42 }),
  onChange: (data, prev) => console.log("Changed:", data),
  intervalMs: 2000,
});

// Even if fetch returns a new object with same content, onChange won't fire
```

### Custom comparator

You can supply a custom comparator to control change detection logic:

```typescript
const poller = Poller.create({
  fetch: async () => ({ id: 1, name: "Alice" }),
  onChange: (data, prev) => console.log("Changed:", data.name),
  intervalMs: 2000,
  comparator: (current, previous) => current.name === previous?.name,
});
```

## Error Handling

Errors during fetch or comparator execution are routed to the `onError` callback, if provided. Polling continues after errors.

```typescript
const poller = Poller.create({
  fetch: async () => { throw new Error("Network issue"); },
  onChange: () => {},
  intervalMs: 1000,
  onError: (err) => console.warn("Caught error:", err),
});

await poller.start(); // Continues polling despite error
```

## Overlapping Request Handling

If a fetch is still pending when the next interval arrives, the new poll is skipped to avoid overlapping requests.

```typescript
const poller = Poller.create({
  fetch: async () => {
    await new Promise(r => setTimeout(r, 2000)); // Simulate slow fetch
    return "data";
  },
  onChange: () => {},
  intervalMs: 1000, // Won't trigger overlapping fetch
});
```

## API Reference

- `Poller<T>`: Generic polling class
- `PollerOptions<T>`: Options interface for configuring the poller
- `Poller.create<T>(options: PollerOptions<T>): Poller<T>`: Static factory method (recommended)