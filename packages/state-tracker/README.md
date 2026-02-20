# @hardlydifficult/state-tracker

TypeScript state tracker with atomic JSON persistence, auto-save debouncing, typed migrations, and graceful fallback.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Quick Start

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

const tracker = new StateTracker({
  key: "app-config",
  default: { theme: "light", notifications: true },
  autoSaveMs: 500,
});

tracker.set({ theme: "dark" }); // saves debounced
console.log(tracker.state); // { theme: "dark", notifications: true }

tracker.reset(); // restores default
```

## Core State Management

The `StateTracker` class provides type-safe state persistence with automatic atomic writes and in-memory caching.

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | — | Unique identifier; must contain only alphanumeric characters, hyphens, underscores |
| `default` | `T` | — | Initial state used if no saved state is found |
| `stateDirectory?` | `string` | `~/.app-state` | Override storage directory (or `STATE_TRACKER_DIR` env var) |
| `autoSaveMs?` | `number` | `0` | Debounce delay (ms) after state changes |
| `onEvent?` | `(event) => void` | — | Optional callback for debug/info/warn/error events |

### Instance Properties

- `state: Readonly<T>` — Current in-memory state (read-only)
- `isPersistent: boolean` — Whether disk storage is available
- `getFilePath(): string` — Full path to the JSON file

### Instance Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `load()` / `loadSync()` | `(): T` | Sync load (uses defaults on error) |
| `save(value)` | `(value: T): void` | Sync save to disk |
| `set(newState)` | `(newState: T): void` | Replace state, triggers auto-save |
| `update(changes)` | `(changes: Partial<T>): void` | Shallow merge (object state only) |
| `reset()` | `(): void` | Restore to default value |

### Async Persistence API

Async methods support graceful degradation when file system access fails.

#### Methods

- `loadAsync(): Promise<void>` — Loads state from disk; sets `isPersistent` to `false` on failure
- `saveAsync(): Promise<void>` — Atomic async save using temp file + rename
- Both are idempotent: subsequent calls after first `loadAsync` are no-ops

#### Example

```typescript
const tracker = new StateTracker({
  key: "settings",
  default: { fontSize: 14 },
  stateDirectory: "/app/state",
});

await tracker.loadAsync();
console.log(tracker.isPersistent); // true (or false if directory not writable)

tracker.set({ fontSize: 16 });
await tracker.saveAsync();
```

## Auto-Save with Debouncing

Set `autoSaveMs` in the constructor to debounce writes after state changes via `set()` or `update()`.

```typescript
const tracker = new StateTracker({
  key: "editor",
  default: { text: "", cursor: 0 },
  autoSaveMs: 300,
});

tracker.set({ text: "Hello" }); // will auto-save after 300ms
tracker.update({ cursor: 5 }); // cancels pending auto-save, re-schedules
```

- `save()` and `saveAsync()` cancel pending auto-saves and write immediately
- If `autoSaveMs <= 0`, no debounced saves are scheduled
- On persistent storage failure, auto-save is disabled until `loadAsync` succeeds

## Typed Migrations

Support legacy state formats with typed migrations.

### Migration Interface

```typescript
interface StateTrackerMigration<TCurrent, TLegacy = unknown> {
  name?: string;
  isLegacy(input: unknown): input is TLegacy;
  migrate(legacy: TLegacy): TCurrent;
}
```

### Helper

- `defineStateMigration<TCurrent, TLegacy>(migration)` — Type-safe migration builder

### Usage

```typescript
interface LegacyState { offset: number; completedIds: string[] }
interface CurrentState { cursor: number; done: string[] }

const migration = defineStateMigration<CurrentState, LegacyState>({
  name: "cursor-migration",
  isLegacy(input): input is LegacyState {
    return (
      input &&
      typeof input === "object" &&
      "offset" in input &&
      "completedIds" in input
    );
  },
  migrate(legacy) {
    return {
      cursor: legacy.offset,
      done: legacy.completedIds,
    };
  },
});

const tracker = new StateTracker({
  key: "tasks",
  default: { cursor: 0, done: [] } as CurrentState,
});

// Load with migration
const value = tracker.loadOrDefault({ migrations: [migration] });
// Legacy { offset: 3, completedIds: ["a", "b"] } → { cursor: 3, done: ["a", "b"] }
```

### Envelope Format

Saved state uses a JSON envelope:

```json
{
  "value": { /* your state */ },
  "lastUpdated": "2025-04-05T12:34:56.789Z",
  "meta": { /* optional metadata */ }
}
```

- `load()` and `loadAsync()` extract `value` and merge missing keys from `default`
- Supports raw legacy objects (without envelope) with default-merge

## Event Logging

Optionally track runtime events via the `onEvent` callback.

### Event Types

- `debug`: Internal behavior (e.g., auto-save completion)
- `info`: Startup/loading (e.g., no existing state, directory creation)
- `warn`: recoverable issues (e.g., storage unavailable, migration failure)
- `error`: unrecoverable errors (e.g., disk write failure)

### Example

```typescript
const tracker = new StateTracker({
  key: "my-state",
  default: {},
  onEvent: (event) => {
    if (event.level === "error") console.error(event.message, event.context);
  },
});

await tracker.loadAsync();
// emits info: "No existing state file" or "Loaded state from disk"
```

## Appendix: Key Sanitization

Keys must match `^[A-Za-z0-9_-]+$`. Invalid keys throw at construction:

```typescript
new StateTracker({ key: "../evil", default: 0 });
// Error: StateTracker key contains invalid characters

new StateTracker({ key: "", default: 0 });
// Error: StateTracker key must be a non-empty string
```

State files are written as `<key>.json` inside the state directory.

## Exported API

- `StateTracker<T>` — Main persistence class
- `defineStateMigration<TCurrent, TLegacy>` — Migration builder
- `StateTrackerOptions<T>` — Constructor options
- `StateTrackerEvent` — Event payload
- `StateTrackerEventLevel` — `"debug" \| "info" \| "warn" \| "error"`
- `StateTrackerLoadOrDefaultOptions<T>` — Options for `loadOrDefault`
- `StateTrackerMigration<TCurrent, TLegacy>` — Migration definition
- `StateTrackerSaveMeta` — Optional metadata in save envelope

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
- **Typed migration helper** — declarative migration rules for old JSON shapes
- **API consistency** — all operations work seamlessly across sync/async modes

## Platform Behavior

| Environment | Persistence | Fallback Behavior |
|-------------|-------------|-------------------|
| Node.js     | ✅ File system access | Falls back to memory on errors |
| Browser     | ❌ No file system access | Always in-memory only |
| Bun/Deno    | ⚠️ Experimental support | Depends on environment capabilities |