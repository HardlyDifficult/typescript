# @hardlydifficult/state-tracker

Persistent state management with atomic JSON persistence, debounced auto-save, typed migrations, and graceful fallback to in-memory mode.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Quick Start

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

// Create a tracker for an object state
const tracker = new StateTracker({
  key: "todo-list",
  default: { items: [], nextId: 1 },
});

// Set state (auto-saves with debounce)
tracker.set({ items: [{ id: 1, text: "Learn StateTracker" }], nextId: 2 });

// Load state (sync)
const state = tracker.load();
console.log(state); // { items: [{ id: 1, text: "Learn StateTracker" }], nextId: 2 }

// Shallow merge updates
tracker.update({ items: [...state.items, { id: 2, text: "Test it!" }] });

// Restore defaults
tracker.reset();
```

## Persistence

StateTracker persists data to JSON files using atomic writes (temp file + rename). If disk access fails (e.g., permissions issues), it gracefully degrades to in-memory mode.

```typescript
const tracker = new StateTracker({
  key: "app-settings",
  default: { theme: "light", lang: "en" },
  stateDirectory: "/custom/path", // optional, defaults to ~/.app-state
  autoSaveMs: 1000,              // debounce delay (0 = no auto-save)
  onEvent: (event) => console.log(event.level, event.message)
});

await tracker.loadAsync();   // Async load from disk
tracker.set({ theme: "dark" });
await tracker.saveAsync();   // Explicit async save
```

### File Format

Files are stored as JSON envelopes:

```json
{
  "value": { ...state... },
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "meta": { "source": "sync" }  // optional
}
```

### API

#### `new StateTracker(options)`

| Option           | Type              | Description |
|------------------|-------------------|-------------|
| `key`            | `string`          | Unique identifier (alphanumeric, `-`, `_` only) |
| `default`        | `T`               | Initial state value |
| `stateDirectory` | `string` (optional) | Directory for persisted files (default: `~/.app-state`) |
| `autoSaveMs`     | `number` (optional) | Debounce delay in ms (default: `0`, no auto-save) |
| `onEvent`        | `(event) => void` (optional) | Event callback |

#### `tracker.state: Readonly<T>`

Cached in-memory state (sync).

#### `tracker.isPersistent: boolean`

Whether disk persistence is available.

#### `tracker.getFilePath(): string`

Get the absolute path to the state file.

## Auto-Save

Auto-save triggers a debounced atomic save when you call `set()`, `update()`, or `reset()`. Multiple rapid changes only result in one save.

```typescript
const tracker = new StateTracker({
  key: "counter",
  default: 0,
  autoSaveMs: 500
});

tracker.set(1); // schedules save
tracker.set(2); // cancels previous schedule, schedules new
tracker.set(3); // cancels again, schedules final

// After 500ms, only { value: 3, ... } is written to disk
```

### Manual Overrides

Calling `save()` or `saveAsync()` cancels any pending auto-save and saves immediately.

```typescript
tracker.set(10);
// ... later
tracker.save(20); // cancels pending auto-save, writes 20 immediately
```

## Migrations

Support typed migrations from legacy state formats using `defineStateMigration`.

```typescript
import { StateTracker, defineStateMigration } from "@hardlydifficult/state-tracker";

interface LegacyState {
  offset: number;
  completedIds: string[];
}

interface CurrentState {
  cursor: number;
  done: string[];
}

const migration = defineStateMigration<CurrentState, LegacyState>({
  name: "cursor-migration",
  isLegacy(input): input is LegacyState {
    return input !== null &&
      typeof input === "object" &&
      typeof (input as any).offset === "number" &&
      Array.isArray((input as any).completedIds);
  },
  migrate(legacy) {
    return {
      cursor: legacy.offset,
      done: legacy.completedIds
    };
  }
});

const tracker = new StateTracker({
  key: "legacy-data",
  default: { cursor: 0, done: [] },
});

// Load with migration
const state = tracker.loadOrDefault({ migrations: [migration] });
// If file contains raw { offset, completedIds }, it is migrated
```

### Compatibility

- **v1 envelope format**: `{ value, lastUpdated }`
- **Legacy raw format**: `{ ...T }` (without envelope)
- **v2 envelope format**: `{ value, lastUpdated, meta? }`

Migrations handle both legacy formats and are applied during `loadOrDefault()` and `loadSync()`.

## Async API

Use `loadAsync()` and `saveAsync()` for non-blocking persistence.

```typescript
const tracker = new StateTracker({
  key: "async-state",
  default: { count: 0 },
});

await tracker.loadAsync();   // Loads from disk (idempotent)
tracker.set({ count: 42 });
await tracker.saveAsync();   // Saves atomically
```

### Idempotent `loadAsync()`

Calling `loadAsync()` multiple times is safe. Subsequent calls after the first are no-ops.

```typescript
await tracker.loadAsync();  // Load
await tracker.loadAsync();  // No-op, preserves current state
```

## Event Logging

Use the `onEvent` callback to log internal events.

```typescript
const tracker = new StateTracker({
  key: "logging",
  default: {},
  onEvent: (event) => {
    console.log(event.level, event.message, event.context);
  }
});

// Events include:
// - "info": "No existing state file, using defaults"
// - "debug": "Loaded state from disk", "Saved state to disk"
// - "warn": "Storage unavailable, running in-memory"
// - "error": "Failed to save state"
// - "info": "Migrated legacy state payload"
// - "warn": "Legacy state migration failed"
```

## Types

```typescript
export type StateTrackerEventLevel = "debug" | "info" | "warn" | "error";

export interface StateTrackerEvent {
  level: StateTrackerEventLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface StateTrackerMigration<TCurrent, TLegacy = unknown> {
  name?: string;
  isLegacy(input: unknown): input is TLegacy;
  migrate(legacy: TLegacy): TCurrent;
}

export interface StateTrackerLoadOrDefaultOptions<T> {
  migrations?: readonly StateTrackerMigration<T>[];
}

export type StateTrackerSaveMeta = Record<string, unknown>;
```

## Setup

StateTracker requires no external services. Set the `STATE_TRACKER_DIR` environment variable to override the default state directory (`~/.app-state`).

## Appendix

### Key Validation

Keys must match `/^[A-Za-z0-9_-]+$/`. Invalid keys throw an error at construction.

```typescript
// ✅ Valid
new StateTracker({ key: "app-config", ... });
new StateTracker({ key: "my_app_v2", ... });

// ❌ Invalid
new StateTracker({ key: "../evil", ... });
new StateTracker({ key: "foo/bar", ... });
new StateTracker({ key: "foo.bar", ... });
```

### Fallback to Defaults

If a state file is missing, unreadable, or invalid JSON, `load()` and `loadOrDefault()` return the default value instead of throwing.

### Primitive vs Object State

- `update()` only works on object types (throws on primitives/arrays).
- `set()` and `reset()` work on any type.

### Environment Compatibility

- **Node.js**: Full file system support (default mode).
- **Container/CI**: Falls back to in-memory mode if the state directory is unwritable.
- **Browser**: Not supported (no file system API).