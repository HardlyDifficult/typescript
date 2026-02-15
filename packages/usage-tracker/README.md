# @hardlydifficult/usage-tracker

Accumulate numeric metrics over time with automatic session vs. cumulative dual-tracking, backed by persistent storage.

## Installation

```bash
npm install @hardlydifficult/usage-tracker @hardlydifficult/state-tracker
```

## Quick Start

```typescript
import { UsageTracker } from "@hardlydifficult/usage-tracker";

// Type is inferred from defaults — no interface needed
const tracker = await UsageTracker.create({
  key: "my-usage",
  default: {
    api: { requests: 0, tokens: 0, costUsd: 0 },
    audio: { requests: 0, durationSeconds: 0 },
  },
});

// Record metrics — deeply adds to both session and cumulative
tracker.record({ api: { requests: 1, tokens: 500, costUsd: 0.01 } });

// Read state
tracker.session;          // { api: { requests: 1, ... }, audio: { ... } }
tracker.cumulative;       // all-time totals (persists across restarts)
tracker.sessionStartedAt; // ISO string
tracker.trackingSince;    // ISO string
tracker.isPersistent;     // true if persisted to disk
```

## API Reference

### `UsageTracker.create(options)`

Static async factory — the only way to create an instance. Loads persisted state and starts a new session.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `key` | `string` | Yes | Unique persistence key |
| `default` | `T` | Yes | Default metrics shape (all leaves must be 0) |
| `stateDirectory` | `string` | No | Directory for state files |
| `autoSaveMs` | `number` | No | Auto-save interval in ms |
| `onEvent` | `(event) => void` | No | Logging callback |

### `tracker.record(values)`

Deeply adds numeric values to both session and cumulative counters. Only provide the fields you are incrementing.

```typescript
// Only increments the specified fields
tracker.record({ api: { requests: 1, tokens: 500 } });
// audio fields are unchanged
```

### `tracker.save()`

Force-save current state to disk immediately. Returns a promise.

### Getters

| Getter | Type | Description |
|--------|------|-------------|
| `session` | `Readonly<T>` | Current session metrics |
| `cumulative` | `Readonly<T>` | All-time metrics |
| `sessionStartedAt` | `string` | ISO timestamp of session start |
| `trackingSince` | `string` | ISO timestamp of first tracking |
| `isPersistent` | `boolean` | Whether data persists to disk |

## `deepAdd(target, source)`

Exported utility that recursively adds numeric values from source into target. Mutates target in place. Useful for merging metrics snapshots outside of UsageTracker.

```typescript
import { deepAdd } from "@hardlydifficult/usage-tracker";

const totals = { requests: 5, tokens: 1000 };
deepAdd(totals, { requests: 1, tokens: 500 });
// totals is now { requests: 6, tokens: 1500 }
```
