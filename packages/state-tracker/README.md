# @hardlydifficult/state-tracker

Typed persisted state with one opinionated workflow:

1. Open a tracker.
2. Mutate business state.
3. Let storage persistence happen in the background.

Storage is first-class. File storage is built in, but Redis and future backends use the same `StateStorage` interface.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Recommended Usage

Prefer `StateTracker.open()` plus `mutate()`. That gives clients a loaded tracker, a single storage abstraction, and business-focused updates without object spread boilerplate.

```typescript
import { StateTracker, createFileStorage } from "@hardlydifficult/state-tracker";

const tracker = await StateTracker.open({
  key: "sync-jobs",
  default: { cursor: 0, processedIds: [] as string[] },
  storage: createFileStorage({ directory: ".state" }),
  autoSaveMs: 1000,
});

tracker.mutate((state) => {
  state.cursor = 42;
  state.processedIds.push("job_123");
});

console.log(tracker.state);
```

Why this is the preferred path:

- `open()` gives you a ready tracker in one call.
- `storage` keeps file storage optional instead of assumed.
- `mutate()` keeps update logic about the domain, not object copying.
- `autoSaveMs` removes most manual persistence calls.

## Storage

### File Storage

Use `createFileStorage()` when local disk is the right backing store.

```typescript
import { StateTracker, createFileStorage } from "@hardlydifficult/state-tracker";

const tracker = await StateTracker.open({
  key: "worker-state",
  default: { lastRunAt: "" },
  storage: createFileStorage({ directory: "/var/app/state" }),
  autoSaveMs: 1000,
});

tracker.mutate((state) => {
  state.lastRunAt = new Date().toISOString();
});
```

### Redis Or Any Custom Backend

Any backend that can read and write a JSON string by key can implement `StateStorage`.

```typescript
import {
  StateTracker,
  type StateStorage,
} from "@hardlydifficult/state-tracker";

const storage: StateStorage = {
  async read(key) {
    return redis.get(`app:state:${key}`);
  },
  async write(key, value) {
    await redis.set(`app:state:${key}`, value);
  },
};

const tracker = await StateTracker.open({
  key: "billing",
  default: { lastInvoiceId: 0 },
  storage,
  autoSaveMs: 1000,
});

tracker.mutate((state) => {
  state.lastInvoiceId += 1;
});
```

That same shape works for Redis, DynamoDB, Postgres, KV stores, or any future backend.

## Migrations

Use migrations when an old persisted payload needs to be reshaped into the current state.

```typescript
import {
  StateTracker,
  defineStateMigration,
  createFileStorage,
} from "@hardlydifficult/state-tracker";

interface LegacyState {
  offset: number;
  completedIds: string[];
}

const migration = defineStateMigration<
  { cursor: number; done: string[] },
  LegacyState
>({
  name: "sync-state-v0",
  isLegacy(input): input is LegacyState {
    return (
      input !== null &&
      typeof input === "object" &&
      typeof (input as Record<string, unknown>).offset === "number" &&
      Array.isArray((input as Record<string, unknown>).completedIds)
    );
  },
  migrate(legacy) {
    return {
      cursor: legacy.offset,
      done: legacy.completedIds,
    };
  },
});

const tracker = await StateTracker.open({
  key: "sync-state",
  default: { cursor: 0, done: [] as string[] },
  storage: createFileStorage({ directory: ".state" }),
  migrations: [migration],
});
```

## API

### Main Entry Points

| API | Purpose |
| --- | --- |
| `StateTracker.open(options)` | Preferred way to create and load a tracker |
| `new StateTracker(options)` | Low-level constructor when you want manual lifecycle control |
| `createFileStorage(options?)` | Built-in file storage implementation |
| `type StateStorage` | Minimal interface for Redis and other backends |

### StateTracker

| API | Notes |
| --- | --- |
| `await tracker.loadAsync(options?)` | Loads persisted state and returns the current snapshot |
| `await tracker.saveAsync()` | Persists current state and returns the current snapshot |
| `tracker.mutate((draft) => { ... })` | Preferred for object and array state |
| `tracker.set(nextState)` | Replace the full state |
| `tracker.reset()` | Restore defaults |
| `tracker.update(partial)` | Legacy shallow merge for flat object state only |
| `tracker.state` | Defensive cloned snapshot of current state |
| `tracker.isPersistent` | `true` only when the configured storage is currently usable |
| `tracker.getFilePath()` | Available only when using file storage |

## Persistence Format

The stored payload is wrapped in a small envelope:

```json
{
  "value": { "cursor": 42 },
  "lastUpdated": "2026-03-07T12:00:00.000Z"
}
```

Raw legacy JSON is still read for backward compatibility and gets rewritten into the envelope on the next save.

## Error Handling

- Invalid keys throw during construction.
- Read failures fall back to defaults and keep the tracker in memory-only mode.
- Write failures emit an `error` event and disable persistence for that tracker instance.

## Compatibility

`storage` is the preferred option for new code.

`stateDirectory` and `storageAdapter` are still supported for existing callers, but they are compatibility shims around the storage-first API.

## Environment Variable

| Variable | Purpose |
| --- | --- |
| `STATE_TRACKER_DIR` | Default directory used by `createFileStorage()` when no directory is provided |
