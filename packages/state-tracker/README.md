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

## State Persistence

The `StateTracker` class provides atomic JSON state persistence using file-based storage with graceful fallback to in-memory mode when disk access fails.

### Sync API

For tools and scripts, use the synchronous API:

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

const store = new StateTracker<number>({
  key: "counter",
  default: 0,
});

const count = store.load(); // returns current state
store.save(count + 1); // writes entire state atomically
```

### Async API

For long-running servers, use the async API with auto-save:

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

## Options

| Option | Type | Description |
|--------|------|-------------|
| `key` | `string` | Unique identifier for the state file (required) |
| `default` | `T` | Default value when no state file exists (required) |
| `stateDirectory` | `string` | Directory for state files (default: `$STATE_TRACKER_DIR` or `~/.app-state`) |
| `autoSaveMs` | `number` | Auto-save interval after `update()`/`set()`/`reset()` (default: 0 = disabled) |
| `onEvent` | `(event: StateTrackerEvent) => void` | Event callback for logging (`{ level, message, context }`) |

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

### `update()`

For object state types, `update()` merges partial changes:

```typescript
const store = new StateTracker<{ count: number; name: string }>({
  key: "demo",
  default: { count: 0, name: "initial" },
});

store.update({ count: 42 });
console.log(store.state); // { count: 42, name: "initial" }
```

Calling `update()` on a primitive state throws:

```typescript
const primitive = new StateTracker<number>({ key: "num", default: 0 });
primitive.update(100 as never); // throws: "update() can only be used when state is a non-array object"
```

## Event Handling

Events are emitted for key lifecycle operations with configurable logging:

```typescript
const store = new StateTracker<AppState>({
  key: "app",
  default: { version: 1 },
  onEvent: ({ level, message, context }) => {
    console.log(`[${level}] ${message}`, context);
  },
});

await store.loadAsync();
// Example output: [info] No existing state file, using defaults { path: ".../app.json" }

store.set({ version: 2 });
await store.saveAsync();
// Example output: [debug] Saved state to disk { path: ".../app.json" }
```

Event levels: `"debug"`, `"info"`, `"warn"`, `"error"`

## Features

- **Type inference** from the default value
- **Atomic writes** via temp file + rename to prevent corruption
- **Key sanitization** to prevent path traversal (alphanumeric, hyphens, underscores only)
- **Graceful degradation** — runs in-memory when disk is unavailable
- **Auto-save** — debounced saves after state mutations
- **Legacy format support** — reads both v1 envelope format and legacy PersistentStore formats

## Legacy Format Migration

The library transparently handles migration from legacy formats:

```typescript
// If disk contains legacy format: { count: 42 }
// Load merges with defaults: { count: 42, extra: true }
await store.loadAsync();

// Subsequent save writes new envelope format:
// { value: { count: 42, extra: true }, lastUpdated: "2025-01-01T..." }
await store.saveAsync();
```

## Exported Types

The package also exports the following types for advanced usage:

- `StateTrackerOptions<T>` — Constructor options interface
- `StateTrackerEvent` — Event payload interface `{ level, message, context? }`
- `StateTrackerEventLevel` — Event level union type `"debug" \| "info" \| "warn" \| "error"`