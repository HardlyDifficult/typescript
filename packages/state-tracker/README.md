# @hardlydifficult/state-tracker

Atomic JSON state persistence with sync/async APIs, auto-save debouncing, and graceful degradation to in-memory mode for TypeScript.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Quick Start

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

const tracker = new StateTracker({
  key: "user-settings",
  default: { theme: "light", notifications: true },
  autoSaveMs: 1000,
});

// Load persisted state (sync or async)
tracker.load(); // or await tracker.loadAsync();

// Update state and auto-save
tracker.update({ theme: "dark" });
// State is saved automatically after 1 second of inactivity

// Read current state
console.log(tracker.state); // { theme: "dark", notifications: true }
```

## State Management

The `StateTracker` class provides a robust interface for managing persistent application state.

### Constructor

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | — | Unique identifier for the state file (alphanumeric, hyphens, underscores only) |
| `default` | `T` | — | Default state value used if no persisted state exists |
| `stateDirectory` | `string` | `~/.app-state` or `$STATE_TRACKER_DIR` | Directory to store state files |
| `autoSaveMs` | `number` | `0` | Debounce delay (ms) for auto-save after state changes |
| `onEvent` | `(event: StateTrackerEvent) => void` | `undefined` | Callback for internal events (debug/info/warn/error) |

### State Accessors

- **`state: Readonly<T>`** — Read-only getter for the current in-memory state.
- **`isPersistent: boolean`** — Indicates whether disk persistence is available (set after `loadAsync()`).

```typescript
const tracker = new StateTracker({
  key: "counter",
  default: 0,
  stateDirectory: "./data",
});

console.log(tracker.state); // 0
await tracker.loadAsync();
console.log(tracker.isPersistent); // true if disk write succeeded
```

### Persistence Operations

#### `load(): T`
Synchronous state load from disk. Returns the current state (default if missing or corrupted).

```typescript
const tracker = new StateTracker({
  key: "config",
  default: { version: 1 },
});
const config = tracker.load(); // Loads from disk or uses default
```

#### `save(value: T): void`
Synchronous atomic save using temp file + rename.

```typescript
tracker.save({ version: 2 });
// File is updated atomically; previous state preserved if crash occurs mid-write
```

#### `loadAsync(): Promise<void>`
Async state load with graceful degradation. Sets `isPersistent = false` on failure instead of throwing.

```typescript
const tracker = new StateTracker({
  key: "preferences",
  default: { darkMode: false },
});

await tracker.loadAsync();
if (!tracker.isPersistent) {
  console.warn("Running in-memory mode (disk unavailable)");
}
```

#### `saveAsync(): Promise<void>`
Async atomic save (temp file + rename). Cancels any pending auto-save before writing.

```typescript
tracker.set({ darkMode: true });
await tracker.saveAsync(); // Immediate save, bypassing debounce
```

### State Mutations

#### `set(newState: T): void`
Replace entire state and schedule auto-save.

```typescript
tracker.set({ darkMode: true, theme: "midnight" });
// Auto-saves after configured delay (if autoSaveMs > 0)
```

#### `update(changes: Partial<T>): void`
Shallow merge for object types and schedule auto-save.

```typescript
tracker.update({ theme: "dark" }); // Preserves darkMode: true
```

> **Note:** Throws at runtime if state is not an object (array/primitive).

#### `reset(): void`
Restore state to the default value and schedule auto-save.

```typescript
tracker.reset(); // Reverts to default state
```

### File Management

#### `getFilePath(): string`
Returns the full path to the state file.

```typescript
console.log(tracker.getFilePath()); // "/home/user/.app-state/counter.json"
```

## Event System

Events are emitted for internal operations via the optional `onEvent` callback.

| Level | Description |
|-------|-------------|
| `debug` | Low-level operations (e.g., save completion) |
| `info` | Normal operations (e.g., file read/write) |
| `warn` | Recoverable failures (e.g., disk I/O errors) |
| `error` | Non-recoverable failures (e.g., permission issues) |

```typescript
const tracker = new StateTracker({
  key: "app",
  default: {},
  onEvent: (event) => {
    console[event.level](`[${event.level}] ${event.message}`, event.context);
  },
});

await tracker.loadAsync();
// Outputs: [info] Loaded state from disk { path: ".../app.json" }
```

## Persistence Format

### v2 (Envelope) Format
```json
{
  "value": { "theme": "dark", "notifications": true },
  "lastUpdated": "2024-05-01T12:00:00.000Z"
}
```

### Legacy (PersistentStore) Migration
The tracker automatically detects and merges legacy raw JSON objects with defaults on load.

```typescript
// If disk contains: { "count": 42 }
// And default is: { "count": 0, "name": "default" }
// Loaded state becomes: { "count": 42, "name": "default" }
```

After the first `saveAsync()`, files are rewritten in the v2 envelope format.

## Auto-Save Behavior

When `autoSaveMs > 0`, state changes are debounced:

1. `set()` or `update()` triggers a timer.
2. Subsequent changes within the window reset the timer.
3. After `autoSaveMs` ms of inactivity, the state is saved.

```typescript
const tracker = new StateTracker({
  key: "debounced",
  default: { x: 0 },
  autoSaveMs: 500,
});

tracker.set({ x: 1 });
tracker.set({ x: 2 }); // Timer resets
await new Promise(r => setTimeout(r, 100));
tracker.set({ x: 3 }); // Timer resets again

// Only saved once after 500ms of inactivity with final value { x: 3 }
```

Calling `save()` or `saveAsync()` cancels pending auto-saves and writes immediately.

## Types

```typescript
export type StateTrackerEventLevel = "debug" | "info" | "warn" | "error";

export interface StateTrackerEvent {
  level: StateTrackerEventLevel;
  message: string;
  context?: Record<string, unknown>;
}
```

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