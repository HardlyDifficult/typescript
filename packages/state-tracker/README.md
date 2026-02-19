# @hardlydifficult/state-tracker

Atomic JSON state persistence with sync/async APIs, auto-save, and graceful degradation for TypeScript applications.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Quick Start

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

interface AppState {
  requestCount: number;
  lastActiveAt: string;
}

const store = new StateTracker<AppState>({
  key: "my-service",
  default: { requestCount: 0, lastActiveAt: "" },
  stateDirectory: "/var/data",
  autoSaveMs: 5000,
  onEvent: ({ level, message }) => console.log(`[${level}] ${message}`),
});

await store.loadAsync();

store.state.requestCount; // read current state
store.update({ requestCount: store.state.requestCount + 1 }); // partial update
store.set({ requestCount: 0, lastActiveAt: new Date().toISOString() }); // full replace
await store.saveAsync(); // force immediate save
```

## Key Sanitization

StateTracker enforces strict key sanitization to prevent path traversal and invalid characters. Keys must match `/^[A-Za-z0-9_-]+$/`.

```typescript
new StateTracker({ key: "../evil", default: 0 }); // throws: "invalid characters"
new StateTracker({ key: "foo/bar", default: 0 }); // throws: "invalid characters"
```

## Persistence & Graceful Degradation

If storage is unavailable (e.g., due to permissions or read-only filesystem), StateTracker automatically falls back to in-memory mode without throwing errors.

```typescript
const tracker = new StateTracker({
  key: "failing",
  default: { x: 1 },
});

await tracker.loadAsync(); // fails silently on unreadable dir
console.log(tracker.isPersistent); // false
console.log(tracker.state); // uses in-memory default
```

## Sync API: `load()` and `save()`

V1-compatible synchronous operations for environments where async is not preferred or available.

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

const store = new StateTracker<number>({
  key: "counter",
  default: 0,
});

const count = store.load(); // returns current state
store.save(count + 1); // writes entire state atomically
```

## Async API: `loadAsync()` and `saveAsync()`

Async operations that gracefully degrade to in-memory mode on errors.

```typescript
const store = new StateTracker<AppState>({
  key: "app",
  default: { version: 1 },
  stateDirectory: "/var/state",
  autoSaveMs: 5000,
});

await store.loadAsync();
store.set({ version: 2 });
await store.saveAsync(); // Force immediate save
```

## State Manipulation

| Method | Description | Example |
|--------|-------------|---------|
| `set(newState)` | Replace entire state, triggers auto-save | `tracker.set({ count: 5 })` |
| `update(changes)` | Shallow merge (object state only), triggers auto-save | `tracker.update({ count: 5 })` |
| `reset()` | Restore to default, triggers auto-save | `tracker.reset()` |
| `state` (getter) | Read-only current state | `tracker.state` |
| `isPersistent` (getter) | Whether storage is available | `tracker.isPersistent` |

```typescript
const tracker = new StateTracker({
  key: "manip",
  default: { a: 1, b: 2 },
});

tracker.set({ a: 10, b: 20 }); // replaces all
tracker.update({ b: 200 }); // merges: { a: 10, b: 200 }
tracker.reset(); // back to { a: 1, b: 2 }
```

### `update()` on Primitive Types

Calling `update()` on a primitive or array state throws:

```typescript
const primitive = new StateTracker<number>({ key: "num", default: 0 });
primitive.update(100 as never); // throws: "update() can only be used when state is a non-array object"
```

## Auto-Save with Debouncing

Configure automatic debounced saving via `autoSaveMs`. Any state change (`set`, `update`, `reset`) will schedule a save after the delay; rapid changes only trigger one save.

```typescript
const tracker = new StateTracker({
  key: "auto",
  default: { count: 0 },
  autoSaveMs: 500,
});

tracker.set({ count: 1 }); // schedules save in 500ms
tracker.set({ count: 2 }); // cancels previous, schedules new save
tracker.set({ count: 3 }); // cancels again, only this save triggers after 500ms
```

## Event Logging

Optionally receive events for debugging, monitoring, or diagnostics.

```typescript
const tracker = new StateTracker({
  key: "events",
  default: { x: 1 },
  onEvent: (event) => {
    console.log(`[${event.level}] ${event.message}`, event.context);
  },
});

await tracker.loadAsync();
// Outputs: [info] No existing state file, using defaults { path: ".../x.json" }
```

### Event Type Reference

| Field | Type | Description |
|-------|------|-------------|
| `level` | `"debug" \| "info" \| "warn" \| "error"` | Severity level |
| `message` | `string` | Human-readable message |
| `context`? | `Record<string, unknown>` | Additional metadata (e.g., `path`, `error`) |

## File Format

StateTracker uses an envelope format for storage:

```json
{
  "value": <your-state>,
  "lastUpdated": "2025-04-05T12:34:56.789Z"
}
```

### Migration

Legacy raw JSON objects (without envelope) are automatically loaded and merged with defaults, then rewritten in envelope format on next `saveAsync()`.

```typescript
// Old format: { "count": 10 }
await tracker.loadAsync(); // merges with defaults
await tracker.saveAsync(); // writes: { "value": { "count": 10 }, "lastUpdated": "..." }
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | — | Unique identifier (alphanumeric, hyphens, underscores only) |
| `default` | `T` | — | Default value used on missing/corrupt storage |
| `stateDirectory`? | `string` | `~/.app-state` | Custom directory for state files |
| `autoSaveMs`? | `number` | `0` | Debounce delay for auto-save (ms); `0` disables |
| `onEvent`? | `(e: StateTrackerEvent) => void` | — | Event callback for logging |

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `Readonly<T>` | Current in-memory state |
| `isPersistent` | `boolean` | Whether disk storage is available |

## Methods

| Method | Description |
|--------|-------------|
| `loadAsync()` | Async load with graceful degradation (safe to call multiple times) |
| `saveAsync()` | Async atomic save (temp file + rename) |
| `load()` | Sync load (v1 compatible envelope format) |
| `save(value)` | Sync save (overwrites entire state, v1 compatible) |
| `update(changes)` | Shallow merge for object state, triggers auto-save |
| `set(newState)` | Replace entire state, triggers auto-save |
| `reset()` | Restore to defaults, triggers auto-save |
| `getFilePath()` | Returns the full path to the state file |

## Environment Variable

- `STATE_TRACKER_DIR`: Overrides default state directory (`~/.app-state`)

```bash
STATE_TRACKER_DIR=/custom/path npm start
```

## Features

- **Type inference** from the default value
- **Atomic writes** via temp file + rename to prevent corruption
- **Key sanitization** to prevent path traversal (alphanumeric, hyphens, underscores only)
- **Graceful degradation** — runs in-memory when disk is unavailable
- **Auto-save** — debounced saves after state mutations
- **Legacy format support** — reads both v1 envelope format and legacy PersistentStore formats

## Exported Types

The package also exports the following types for advanced usage:

- `StateTrackerOptions<T>` — Constructor options interface
- `StateTrackerEvent` — Event payload interface `{ level, message, context? }`
- `StateTrackerEventLevel` — Event level union type `"debug" \| "info" \| "warn" \| "error"`