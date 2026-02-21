# @hardlydifficult/poller

A lightweight, generic polling utility with debounced triggers, overlapping request handling, and deep equality change detection.

## Installation

```bash
npm install @hardlydifficult/poller
```

## Quick Start

```typescript
import { Poller } from "@hardlydifficult/poller";

// Define a fetch function (e.g., API call)
const fetchUser = async () => {
  const res = await fetch("https://api.example.com/user");
  return res.json();
};

// Create and start the poller
const poller = new Poller(
  fetchUser,
  (current, previous) => {
    console.log("User updated:", current);
  },
  5000 // Poll every 5 seconds
);

await poller.start();
// Polls every 5s, fires onChange only when JSON data changes

// Manually trigger a debounced poll (e.g., after user action)
poller.trigger(1000); // Waits 1s, then polls once

// Stop polling when no longer needed
poller.stop();
```

## Polling Lifecycle

### Start and Stop

- `start()`: Begins polling at the configured interval. Idempotent—safe to call multiple times.
- `stop()`: Cancels timers and clears any pending debounced trigger. Safe to call multiple times.

```typescript
await poller.start();
await poller.start(); // No-op

poller.stop();
poller.stop(); // No-op
```

## Change Detection

### Deep Equality via JSON

Change detection uses `JSON.stringify()` comparison, enabling structural equality checks for objects and arrays—even when references differ.

```typescript
const fetchFn = async () => ({ items: [1, 2, 3] });
const onChange = (current, previous) => {
  // Fires only when structure changes
};

const poller = new Poller(fetchFn, onChange, 1000);
// Even if new object reference returned, onChange won’t fire unless JSON differs
```

### On Change Callback

```typescript
onChange(current: T, previous: T | undefined): void
```

- `current`: Most recently fetched value
- `previous`: Prior value, or `undefined` on first poll

## Error Handling

### Optional Error Callback

Provide an `onError` handler to manage fetch failures; polling continues regardless.

```typescript
const poller = new Poller(
  fetchFn,
  onChange,
  5000,
  (error) => {
    console.warn("Polling error:", error);
  }
);
```

- Errors do not halt the polling interval.
- If `onError` is omitted, errors are silently suppressed.

## Manual Triggering

### Debounced Triggers

- `trigger(debounceMs?: number)`: Schedules a one-time poll after a debounce delay (default: 1000ms).
- Multiple rapid calls cancel previous timeouts—only the last one fires.

```typescript
poller.trigger(2000); // Polls in 2s
poller.trigger(2000); // Cancelled, re-schedule to 2s from now
poller.trigger(2000); // Cancelled again, final delay applies
```

- No-op if `poller` is not running.

## Overlap Handling

- Concurrent fetches are skipped—only one in-flight request is allowed at a time.
- Prevents resource waste and race conditions during slow network calls.

```typescript
// Interval fires every 5s; if fetch takes 6s:
// - Second interval fire is skipped
// - Third interval fire executes after first completes
```

## API Reference

### `Poller<T>`

| Parameter | Type | Description |
|-----------|------|-------------|
| `fetchFn` | `() => Promise<T>` | Async function to fetch data |
| `onChange` | `(current: T, previous: T \| undefined) => void` | Callback on value change |
| `intervalMs` | `number` | Polling interval in milliseconds |
| `onError?` | `(error: unknown) => void` | Optional error handler |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `start` | `(): Promise<void>` | Begin polling immediately and then at `intervalMs` |
| `stop` | `(): void` | Cancel all timers and pending triggers |
| `trigger` | `(debounceMs?: number) => void` | Trigger a one-time poll after debounce delay |