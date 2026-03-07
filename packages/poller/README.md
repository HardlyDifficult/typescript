# @hardlydifficult/poller

Opinionated polling with one entrypoint: `watch()`.

The package starts immediately, emits only when the value changes, and keeps the returned handle small.

## Installation

```bash
npm install @hardlydifficult/poller
```

## Quick Start

```ts
import { watch } from "@hardlydifficult/poller";

const userWatcher = await watch({
  everyMs: 5_000,
  read: () => fetch("/api/user").then((r) => r.json()),
  onChange: (user, previous) => {
    console.log("User changed", user, previous);
  },
});

await userWatcher.refresh();
userWatcher.stop();
```

## API

### `watch(options)`

Starts reading immediately and resolves after the first read attempt completes.

```ts
const watcher = await watch({
  everyMs: 30_000,
  read: () => fetch("/api/data").then((r) => r.json()),
  onChange: (current, previous) => {
    console.log("Changed:", current, previous);
  },
  onError: (error) => {
    console.error("Read failed:", error.message);
  },
  isEqual: (current, previous) => current.id === previous?.id,
});
```

Options:

- `read: () => Promise<T>`
- `onChange: (current: T, previous: T | undefined) => void`
- `everyMs: number`
- `isEqual?: (current: T, previous: T | undefined) => boolean`
- `onError?: (error: Error) => void`

### `watcher.current`

The last emitted value. This stays `undefined` until a read succeeds and is accepted as changed.

### `watcher.refresh()`

Runs a read immediately and returns the current emitted value. If a read is already in flight, the same promise is reused.

```ts
const current = await watcher.refresh();
```

### `watcher.stop()`

Stops the interval and makes future `refresh()` calls a no-op.

```ts
watcher.stop();
```

## Behavior

- The first successful read calls `onChange(current, undefined)`.
- Reads never overlap.
- Deep equality is the default change detection for primitives, arrays, and plain objects.
- Polling continues after read failures.
- If `onError` is omitted, errors are logged with `console.error`.
