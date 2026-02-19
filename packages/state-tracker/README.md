I'll analyze the package structure and source code to generate an accurate README.# @hardlydifficult/state-tracker

Atomic JSON state persistence with sync/async APIs, auto-save, and graceful degradation for TypeScript applications.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Usage

### Quick Start

```typescript
import { StateTracker } from "@hardlydifficult/state-tracker";

const counter = new StateTracker({
  key: "my-counter",
  default: 0,
});

const count = counter.load();
counter.save(count + 1);
```

### Server with Auto-Save

For long-running services, use async APIs with auto-save to persist state changes automatically.

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

// Read current state
console.log(store.state.requestCount); // 0

// Partial update (shallow merge)
store.update({ requestCount: store.state.requestCount + 1 });

// Full replace
store.set({ requestCount: 0, lastActiveAt: new Date().toISOString() });

// Force immediate save
await store.saveAsync();
```

### Type Inference

State type is automatically inferred from the default value.

```typescript
// Inferred as StateTracker<number>
const counter = new StateTracker({
  key: "counter",
  default: 0,
});

// Inferred as StateTracker<string[]>
const tags = new StateTracker({
  key: "tags",
  default: [] as string[],
});

// Inferred as StateTracker<{ name: string; age: number }>
const user = new StateTracker({
  key: "user",
  default: { name: "", age: 0 },
});
```

## API Reference

### `StateTracker<T>`

Main class for managing persistent state.

#### Constructor Options

```typescript
interface StateTrackerOptions<T> {
  key: string;
  default: T;
  stateDirectory?: string;
  autoSaveMs?: number;
  onEvent?: (event: StateTrackerEvent) => void;
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | *required* | Unique identifier for the state file (alphanumeric, hyphens, underscores only) |
| `default` | `T` | *required* | Default value when no state file exists |
| `stateDirectory` | `string` | `$STATE_TRACKER_DIR` or `~/.app-state` | Directory for state files |
| `autoSaveMs` | `number` | `0` (disabled) | Debounce interval in milliseconds for auto-save after mutations |
| `onEvent` | `function` | `undefined` | Callback for logging events |

```typescript
const store = new StateTracker({
  key: "app-config",
  default: { theme: "dark", notifications: true },
  stateDirectory: "./data",
  autoSaveMs: 3000,
  onEvent: ({ level, message, context }) => {
    console.log(`[${level}] ${message}`, context);
  },
});
```

#### Properties

##### `state: Readonly<T>`

Current in-memory state. Updated immediately by `set()`, `update()`, `reset()`, `load()`, and `loadAsync()`.

```typescript
const store = new StateTracker({
  key: "counter",
  default: 0,
});

console.log(store.state); // 0

store.set(42);
console.log(store.state); // 42
```

##### `isPersistent: boolean`

Whether disk storage is available. Returns `false` if storage failed during `loadAsync()`.

```typescript
await store.loadAsync();

if (store.isPersistent) {
  console.log("State will be saved to disk");
} else {
  console.log("Running in-memory only");
}
```

#### Methods

##### `load(): T`

Synchronously loads state from disk. Returns the saved value or default if no file exists.

```typescript
const store = new StateTracker({
  key: "counter",
  default: 0,
});

const count = store.load();
console.log(count); // 0 (or saved value)
```

##### `save(value: T): void`

Synchronously saves state to disk using atomic write (temp file + rename). Updates internal state cache.

```typescript
const store = new StateTracker({
  key: "counter",
  default: 0,
});

store.save(42);
// File written atomically to disk
```

##### `loadAsync(): Promise<void>`

Asynchronously loads state with graceful degradation. Sets `isPersistent` to `false` on failure instead of throwing. Safe to call multiple times (subsequent calls are no-ops).

```typescript
const store = new StateTracker({
  key: "config",
  default: { theme: "light" },
});

await store.loadAsync();
console.log(store.state); // { theme: "light" } or loaded value
```

##### `saveAsync(): Promise<void>`

Asynchronously saves state using atomic write. Cancels any pending auto-save. No-op if `isPersistent` is `false`.

```typescript
store.set({ theme: "dark" });
await store.saveAsync();
// State immediately written to disk
```

##### `set(newState: T): void`

Replaces entire state and schedules auto-save if `autoSaveMs > 0`.

```typescript
const store = new StateTracker({
  key: "user",
  default: { name: "", age: 0 },
  autoSaveMs: 1000,
});

await store.loadAsync();

store.set({ name: "Alice", age: 30 });
// Auto-save scheduled for 1000ms from now
```

##### `update(changes: Partial<T>): void`

Shallow merges changes into current state (object types only). Schedules auto-save if `autoSaveMs > 0`. Throws if state is not a non-array object.

```typescript
const store = new StateTracker({
  key: "settings",
  default: { theme: "light", notifications: true, volume: 50 },
  autoSaveMs: 1000,
});

await store.loadAsync();

store.update({ theme: "dark" });
console.log(store.state);
// { theme: "dark", notifications: true, volume: 50 }
```

##### `reset(): void`

Restores state to default value and schedules auto-save if `autoSaveMs > 0`.

```typescript
const store = new StateTracker({
  key: "counter",
  default: 0,
  autoSaveMs: 1000,
});

store.set(100);
console.log(store.state); // 100

store.reset();
console.log(store.state); // 0
```

##### `getFilePath(): string`

Returns the absolute path to the state file.

```typescript
const store = new StateTracker({
  key: "my-app",
  default: {},
  stateDirectory: "/var/data",
});

console.log(store.getFilePath());
// /var/data/my-app.json
```

### Types

#### `StateTrackerEvent`

Event object passed to `onEvent` callback.

```typescript
interface StateTrackerEvent {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}
```

```typescript
const store = new StateTracker({
  key: "app",
  default: {},
  onEvent: ({ level, message, context }) => {
    if (level === "error") {
      console.error(message, context);
    }
  },
});
```

## Features

### Atomic Writes

All saves use atomic write operations (temp file + rename) to prevent corruption from interrupted writes.

```typescript
// Even if process crashes during save, state file remains intact
store.save(newValue);
```

### Graceful Degradation

When disk storage is unavailable, StateTracker continues operating in-memory without throwing errors.

```typescript
await store.loadAsync();

if (!store.isPersistent) {
  console.warn("Running in-memory mode");
}

// All operations still work, just not persisted
store.set(newValue);
```

### Auto-Save Debouncing

Multiple rapid state changes trigger only one save after the debounce period.

```typescript
const store = new StateTracker({
  key: "counter",
  default: 0,
  autoSaveMs: 5000,
});

await store.loadAsync();

store.set(1);
store.set(2);
store.set(3);
// Only one save occurs 5 seconds after the last set()
```

### Key Sanitization

Keys are validated to prevent path traversal attacks. Only alphanumeric characters, hyphens, and underscores are allowed.

```typescript
// ✅ Valid keys
new StateTracker({ key: "my-app", default: {} });
new StateTracker({ key: "user_settings", default: {} });
new StateTracker({ key: "config123", default: {} });

// ❌ Invalid keys (throws error)
new StateTracker({ key: "../etc/passwd", default: {} });
new StateTracker({ key: "foo/bar", default: {} });
new StateTracker({ key: "app.config", default: {} });
```

### Legacy Format Support

Automatically reads both v1 envelope format (`{ value, lastUpdated }`) and legacy raw JSON format, merging with defaults when needed.

```typescript
// Reads both formats:
// { "value": {...}, "lastUpdated": "..." }  (v1)
// { "count": 42, "name": "..." }            (legacy)

const store = new StateTracker({
  key: "migrated-app",
  default: { count: 0, name: "", extra: true },
});

await store.loadAsync();
// Legacy fields merged with defaults
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STATE_TRACKER_DIR` | Override default state directory (`~/.app-state`) |

```bash
export STATE_TRACKER_DIR=/var/app-state
node app.js
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0 (for type inference)