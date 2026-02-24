# @hardlydifficult/poller

A lightweight polling utility with debounced manual triggers, overlapping request handling, and deep equality change detection.

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

## Options

```typescript
interface PollerOptions<T> {
  fetch: () => Promise<T>;
  onChange: (current: T, previous: T | undefined) => void;
  intervalMs: number;
  onError?: (error: unknown) => void;
  debounceMs?: number; // default 1000
  comparator?: (current: T, previous: T | undefined) => boolean;
}
```

`comparator` should return `true` when values are considered equal (no change). By default Poller compares values using `JSON.stringify`.

## Error Handling

```typescript
const poller = new Poller({
  fetch: async () => {
    throw new Error("Network failure");
  },
  onChange: () => {},
  intervalMs: 2000,
  onError: (error) => console.error("Poll failed:", error),
});
```

## Custom Comparator

```typescript
const poller = new Poller({
  fetch: async () => ({ id: "123", updatedAt: Date.now() }),
  onChange: (current) => console.log("Changed", current),
  intervalMs: 1000,
  comparator: (current, previous) => current.id === previous?.id,
});
```
