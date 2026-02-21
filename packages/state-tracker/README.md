# @hardlydifficult/state-tracker

Persistent state management with atomic JSON persistence, debounced auto-save, typed migrations, and graceful fallback to in-memory mode.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Quick Start

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

interface AppState {
  count: number;
  name: string;
}

const tracker = new StateTracker<AppState>({
  key: "my-app",
  default: { count: 0, name: "default" }
});

// Save state synchronously
tracker.save({ count: 42, name: "example" });

// Load state
const state = tracker.load();
console.log(state); // { count: 42, name: "example" }

// Update with debounced auto-save
tracker.set({ count: 100, name: "auto-saved" });
```

## Core API

### StateTracker

A robust state management class that persists JSON state to disk using atomic writes (temp file + rename), supports typed migrations, and gracefully degrades to in-memory mode when storage is unavailable.

#### Constructor

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Unique identifier for the state file (alphanumeric, hyphens, and underscores only) |
| `default` | `T` | Default state value used when no saved state exists or loading fails |
| `stateDirectory?` | `string` | Directory to store state files (default: `~/.app-state`) |
| `autoSaveMs?` | `number` | Debounce delay in milliseconds for auto-save after state changes (default: 0, disabled) |
| `onEvent?` | `(event: StateTrackerEvent) => void` | Callback for debug/info/warn/error events |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `Readonly<T>` | Current in-memory state (readonly) |
| `isPersistent` | `boolean` | Whether disk storage is available (`true` after successful `loadAsync()` unless storage failed) |

#### Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `load()` | `T` | Synchronously load state from disk (v1-compatible) |
| `loadOrDefault(options?)` | `T` | Load state or fall back to defaults with optional migrations |
| `save(value)` | `void` | Synchronously save state to disk |
| `saveWithMeta(value, meta?)` | `void` | Save state with optional metadata in the envelope |
| `loadAsync()` | `Promise<void>` | Asynchronously load state, sets `isPersistent` on success/failure |
| `saveAsync()` | `Promise<void>` | Asynchronously save state using atomic write |
| `set(newState)` | `void` | Replace state entirely and schedule auto-save |
| `update(changes)` | `void` | Shallow merge partial state and schedule auto-save (objects only) |
| `reset()` | `void` | Restore state to default and schedule auto-save |
| `getFilePath()` | `string` | Return the full path to the state file |

### defineStateMigration

Helper function to define and type migrations from legacy state formats.

```typescript
import { defineStateMigration, StateTracker } from "@hardlydifficult/state-tracker";

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
    return (
      input !== null &&
      typeof input === "object" &&
      typeof (input as Record<string, unknown>).offset === "number"
    );
  },
  migrate(legacy) {
    return {
      cursor: legacy.offset,
      done: legacy.completedIds
    };
  }
});

const tracker = new StateTracker<CurrentState>({
  key: "data",
  default: { cursor: 0, done: [] }
});

// Load with migration support
const state = tracker.loadOrDefault({ migrations: [migration] });
```

## Event System

The `StateTracker` emits events via the optional `onEvent` callback during operations:

| Level | Description |
|-------|-------------|
| `"debug"` | Detailed operational logs (e.g., successful load/save) |
| `"info"` | Informational messages (e.g., directory creation, no existing state) |
| `"warn"` | Non-fatal issues (e.g., migration failure, storage failure) |
| `"error"` | Critical errors (e.g., file write failure) |

Event type definition:

```typescript
interface StateTrackerEvent {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}
```

## Migrations

### Typed Migrations

Migrations allow backward/forward compatibility for state schema changes. Migrations are applied only when the state matches a legacy format.

```typescript
const tracker = new StateTracker({
  key: "migration-test",
  default: { cursor: 0, done: [] as string[] }
});

const legacyState = { offset: 7, completedIds: ["a", "b"] } as const;
fs.writeFileSync(tracker.getFilePath(), JSON.stringify(legacyState));

const migration = defineStateMigration(
  {
    isLegacy(input): input is typeof legacyState {
      return typeof (input as any).offset === "number";
    },
    migrate(legacy) {
      return { cursor: legacy.offset, done: legacy.completedIds };
    }
  }
);

tracker.loadOrDefault({ migrations: [migration] }); // { cursor: 7, done: ["a", "b"] }
```

### Envelope Format

State files use a JSON envelope format:

```json
{
  "value": <your state>,
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "meta": { "source": "script", "reason": "manual-run" }
}
```

The `meta` field is optional and can include arbitrary metadata.

## Auto-Save

Auto-save is debounced and triggered automatically on `set()` and `update()` when `autoSaveMs > 0`. Multiple rapid updates collapse into a single save.

```typescript
const tracker = new StateTracker({
  key: "autosave",
  default: { count: 0 },
  autoSaveMs: 500
});

tracker.set({ count: 1 }); // Schedule save in 500ms
tracker.set({ count: 2 }); // Cancel previous, schedule save in 500ms
// Only { count: 2 } is saved after 500ms
```

## PersistentStore Compatibility

The `StateTracker` v2 gracefully loads legacy state stored in the raw PersistentStore format (plain JSON without envelope). It automatically migrates to the v2 envelope format on first save.

```typescript
// Legacy format (no envelope):
fs.writeFileSync(filePath, JSON.stringify({ count: 42 }));

const tracker = new StateTracker({
  key: "legacy",
  default: { count: 0, name: "default" }
});

await tracker.loadAsync(); // { count: 42, name: "default" }
await tracker.saveAsync(); // Saves envelope format
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STATE_TRACKER_DIR` | Override default state directory (`~/.app-state`) |

## Error Handling

- Invalid `key` values (empty, invalid characters) throw `Error` during construction
- Corrupted JSON files or unreadable files fall back to defaults instead of throwing
- Write failures emit `error` events (not thrown) and disable persistence (`isPersistent = false`)