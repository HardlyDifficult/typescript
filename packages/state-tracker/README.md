# @hardlydifficult/state-tracker

Persistent state management with atomic JSON persistence, debounced auto-save, typed migrations, and graceful fallback to in-memory mode.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Quick Start

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

const tracker = new StateTracker({
  key: "my-app",
  default: { cursor: 0, done: [] as string[] },
});

tracker.set({ cursor: 5, done: ["task1", "task2"] });
console.log(tracker.state); // { cursor: 5, done: ['task1', 'task2'] }
```

## Core Features

### State Persistence

Sync and async loading and saving with atomic writes using temp file + rename.

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

const tracker = new StateTracker({
  key: "config",
  default: { theme: "dark" },
});

// Sync operations
tracker.save({ theme: "light" });
const value = tracker.load(); // => { theme: "light" }

// Async operations
await tracker.loadAsync(); // loads from disk
tracker.set({ theme: "system" });
await tracker.saveAsync(); // atomic async save
```

### State Access and Mutation

Access cached state and mutate with `set`, `update`, and `reset`.

```typescript
const tracker = new StateTracker({
  key: "settings",
  default: { volume: 50, muted: false },
});

tracker.set({ volume: 75, muted: true });
tracker.update({ volume: 60 }); // shallow merge => { volume: 60, muted: true }
tracker.reset(); // => { volume: 50, muted: false }
```

### Auto-Save with Debounce

Configure auto-save with a debounce delay to batch rapid updates.

```typescript
const tracker = new StateTracker({
  key: "editor",
  default: { content: "" },
  autoSaveMs: 1000,
});

tracker.set({ content: "Draft 1" });
// File saved after 1 second of inactivity

tracker.set({ content: "Draft 2" }); // resets debounce timer
```

### Typed Migrations

Support legacy state formats with type-safe migration definitions.

```typescript
interface LegacyState { offset: number; completedIds: string[] }
interface CurrentState { cursor: number; done: string[] }

const migration = defineStateMigration<CurrentState, LegacyState>({
  name: "sync-state-v0",
  isLegacy(input): input is LegacyState {
    return input !== null && typeof input === "object" &&
      typeof (input as Record<string, unknown>).offset === "number";
  },
  migrate(legacy) {
    return {
      cursor: legacy.offset,
      done: legacy.completedIds,
    };
  },
});

const tracker = new StateTracker({
  key: "legacy-store",
  default: { cursor: 0, done: [] },
});

tracker.loadOrDefault({ migrations: [migration] });
```

### Event Logging

Subscribe to debug, info, warn, and error events.

```typescript
const tracker = new StateTracker({
  key: "logger",
  default: {},
  onEvent: (event) => {
    console.log(`[${event.level}] ${event.message}`, event.context);
  },
});

await tracker.loadAsync();
// Example output: [info] No existing state file, using defaults { path: "/path/to/logger.json" }
```

### Storage Availability

Check `isPersistent` to determine whether disk operations succeeded.

```typescript
const tracker = new StateTracker({
  key: "status",
  default: {},
});

await tracker.loadAsync();
console.log(tracker.isPersistent); // true if file operations working
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

### PersistentStore Compatibility

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

## API Reference

### StateTracker Class

| Method | Description |
|--------|-----------|
| `load(): T` | Sync load from disk, falls back to defaults |
| `loadOrDefault(options?: StateTrackerLoadOrDefaultOptions<T>): T` | Sync load with optional migrations |
| `save(value: T): void` | Sync save with value only |
| `saveWithMeta(value: T, meta?: StateTrackerSaveMeta): void` | Sync save with optional metadata |
| `loadAsync(): Promise<void>` | Async load with graceful fallback |
| `saveAsync(): Promise<void>` | Atomic async save |
| `set(newState: T): void` | Replace state, schedules auto-save |
| `update(changes: Partial<T>): void` | Shallow merge (object state only) |
| `reset(): void` | Restore defaults, schedules auto-save |
| `get state(): Readonly<T>` | Current in-memory state |
| `get isPersistent(): boolean` | Whether disk operations are available |
| `getFilePath(): string` | Full path to state file |

### Options

| Option | Type | Default |
|--------|------|---------|
| `key` | `string` | — |
| `default` | `T` | — |
| `stateDirectory` | `string` | `STATE_TRACKER_DIR` env or `~/.app-state` |
| `autoSaveMs` | `number` | `0` (disabled) |
| `onEvent` | `(event: StateTrackerEvent) => void` | — |

### Event Types

```typescript
type StateTrackerEventLevel = "debug" | "info" | "warn" | "error";

interface StateTrackerEvent {
  level: StateTrackerEventLevel;
  message: string;
  context?: Record<string, unknown>;
}

interface StateTrackerSaveMeta {
  [key: string]: unknown;
}
```

### Migration Type

```typescript
interface StateTrackerMigration<TCurrent, TLegacy = unknown> {
  readonly name?: string;
  isLegacy(input: unknown): input is TLegacy;
  migrate(legacy: TLegacy): TCurrent;
}
```

### defineStateMigration

Helper for typed migration definitions.

```typescript
const migration = defineStateMigration<{ count: number }, { offset: number }>({
  name: "v1-to-v2",
  isLegacy(input): input is { offset: number } {
    return typeof (input as any).offset === "number";
  },
  migrate(legacy) {
    return { count: legacy.offset };
  },
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STATE_TRACKER_DIR` | Override default state directory (`~/.app-state`) |

## Error Handling

- Invalid `key` values (empty, invalid characters) throw `Error` during construction
- Corrupted JSON files or unreadable files fall back to defaults instead of throwing
- Write failures emit `error` events (not thrown) and disable persistence (`isPersistent = false`)