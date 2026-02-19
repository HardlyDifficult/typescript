# @hardlydifficult/usage-tracker

Accumulate numeric metrics over time with automatic session vs. cumulative dual-tracking, backed by persistent storage and optional spend limits.

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

## Creating a Tracker

### `UsageTracker.create(options)`

Static async factory — the only way to create an instance. Loads persisted state and starts a new session.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `key` | `string` | Yes | Unique persistence key (alphanumeric, hyphens, underscores) |
| `default` | `T` | Yes | Default metrics shape — all leaves must be 0 |
| `stateDirectory` | `string` | No | Directory for state files |
| `autoSaveMs` | `number` | No | Auto-save interval in ms (passed to StateTracker) |
| `onEvent` | `(event) => void` | No | Event callback for logging |
| `spendLimits` | `SpendLimit[]` | No | Trailing-window spend limits |
| `onSpendLimitExceeded` | `(status) => void` | No | Callback when a spend limit is exceeded |

```typescript
const tracker = await UsageTracker.create({
  key: "my-app",
  default: {
    api: { requests: 0, tokens: 0, costUsd: 0 },
  },
  stateDirectory: "./data",
  autoSaveMs: 5000,
});
```

## Recording Metrics

### `tracker.record(values)`

Deeply adds numeric values to both session and cumulative counters. Only provide the fields you are incrementing — unspecified fields remain unchanged.

```typescript
// Only increments the specified fields
tracker.record({ api: { requests: 1, tokens: 500 } });
// audio fields are unchanged

// Accumulates across multiple calls
tracker.record({ api: { tokens: 200 } });
// api.tokens is now 700
```

## Reading State

### Getters

| Getter | Type | Description |
|--------|------|-------------|
| `session` | `Readonly<T>` | Current session metrics (since last `create()`) |
| `cumulative` | `Readonly<T>` | All-time metrics (persists across restarts) |
| `sessionStartedAt` | `string` | ISO timestamp of when the current session started |
| `trackingSince` | `string` | ISO timestamp of when cumulative tracking first started |
| `isPersistent` | `boolean` | Whether data persists to disk |

```typescript
console.log(tracker.session);      // { api: { requests: 1, ... } }
console.log(tracker.cumulative);   // { api: { requests: 5, ... } }
console.log(tracker.sessionStartedAt); // "2024-01-15T10:30:00.000Z"
```

## Persistence

### `tracker.save()`

Force-save current state to disk immediately. Returns a promise. Auto-save is handled by StateTracker at the configured interval.

```typescript
tracker.record({ api: { requests: 1 } });
await tracker.save(); // Ensure data is written to disk
```

## Cost Tracking & Spend Limits

Any field ending with `CostUsd` (case-insensitive) is automatically tracked in a time-series. This enables spend-rate queries and optional spend limits.

### `tracker.costInWindow(windowMs)`

Returns total cost (USD) recorded within a trailing window. Works for any window size — not limited to configured spend limits.

```typescript
const tracker = await UsageTracker.create({
  key: "my-app",
  default: {
    api: { requests: 0, estimatedCostUsd: 0 },
    code: { sessions: 0, totalCostUsd: 0 },
  },
});

tracker.record({ api: { estimatedCostUsd: 0.05 } });
tracker.record({ code: { totalCostUsd: 1.5 } });

const costLast60s = tracker.costInWindow(60_000);  // 1.55
const costLast24h = tracker.costInWindow(24 * 60 * 60 * 1000);
```

### Spend Limits

Configure trailing-window spend limits to enforce cost caps. When a limit is exceeded, an optional callback fires and `assertWithinSpendLimits()` throws.

```typescript
const tracker = await UsageTracker.create({
  key: "my-app",
  default: {
    api: { requests: 0, estimatedCostUsd: 0 },
  },
  spendLimits: [
    { windowMs: 60_000, maxSpendUsd: 5, label: "1 minute" },
    { windowMs: 24 * 60 * 60 * 1000, maxSpendUsd: 100, label: "24 hours" },
  ],
  onSpendLimitExceeded: (status) => {
    console.warn(`Spend limit exceeded: ${status.limit.label}`);
  },
});

tracker.record({ api: { estimatedCostUsd: 5.5 } });
tracker.assertWithinSpendLimits(); // Throws SpendLimitExceededError
```

### `tracker.spendStatus()`

Get status of all configured spend limits. Returns an empty array if no limits are configured.

```typescript
const statuses = tracker.spendStatus();
// [
//   {
//     limit: { windowMs: 60_000, maxSpendUsd: 5, label: "1 minute" },
//     spentUsd: 2.5,
//     remainingUsd: 2.5,
//     exceeded: false,
//     resumesAt: null,
//   },
//   ...
// ]
```

### `tracker.assertWithinSpendLimits()`

Throws `SpendLimitExceededError` if any configured limit is currently exceeded. No-op if no spend limits are configured.

```typescript
try {
  tracker.assertWithinSpendLimits();
} catch (err) {
  if (err instanceof SpendLimitExceededError) {
    console.error(`Limit: ${err.status.limit.label}`);
    console.error(`Spent: $${err.status.spentUsd.toFixed(2)}`);
    console.error(`Resumes at: ${err.status.resumesAt}`);
  }
}
```

## Utility Functions

### `deepAdd(target, source)`

Recursively adds numeric values from source into target. Mutates target in place. Useful for merging metrics snapshots outside of UsageTracker.

```typescript
import { deepAdd } from "@hardlydifficult/usage-tracker";

const totals = { api: { requests: 5, tokens: 1000 } };
deepAdd(totals, { api: { requests: 1, tokens: 500 } });
// totals is now { api: { requests: 6, tokens: 1500 } }

// Only keys present in target are updated
deepAdd(totals, { api: { requests: 1, newField: 999 } });
// newField is ignored; totals.api.requests is now 7
```

### `findCostFieldPaths(obj)`

Walk a metrics object and return dot-separated paths for every leaf key ending with `CostUsd` (case-insensitive).

```typescript
import { findCostFieldPaths } from "@hardlydifficult/usage-tracker";

const paths = findCostFieldPaths({
  anthropic: { estimatedCostUsd: 0, tokens: 0 },
  claudeCode: { totalCostUsd: 0, sessions: 0 },
});
// ["anthropic.estimatedCostUsd", "claudeCode.totalCostUsd"]
```

### `extractCostFromDelta(delta, costPaths)`

Extract the total cost from a partial delta by summing values at the given dot-separated cost paths. Safely traverses — missing intermediate keys return 0.

```typescript
import { extractCostFromDelta } from "@hardlydifficult/usage-tracker";

const paths = ["api.estimatedCostUsd", "code.totalCostUsd"];
const cost = extractCostFromDelta(
  { api: { estimatedCostUsd: 0.05 }, code: { totalCostUsd: 1.5 } },
  paths
);
// 1.55
```

## Error Handling

### `SpendLimitExceededError`

Thrown by `assertWithinSpendLimits()` when a spend limit is exceeded. Includes formatted error message and status details.

```typescript
import { SpendLimitExceededError } from "@hardlydifficult/usage-tracker";

try {
  tracker.assertWithinSpendLimits();
} catch (err) {
  if (err instanceof SpendLimitExceededError) {
    console.error(err.message);
    // "Spend limit exceeded: $5.50 spent in trailing 1 minute (limit: $5.00)"
    console.error(err.status);
    // { limit, spentUsd, remainingUsd, exceeded, resumesAt }
  }
}
```

## Types

### `NumericRecord`

Constrains a type to a nested object where every leaf is a number.

```typescript
type MyMetrics = {
  api: { requests: number; tokens: number };
  audio: { durationSeconds: number };
};
// MyMetrics extends NumericRecord ✓
```

### `DeepPartial<T>`

Recursive partial — only provide the fields you are incrementing. Used by `record()`.

```typescript
type Delta = DeepPartial<MyMetrics>;
// { api?: { requests?: number; tokens?: number }; ... }
```

### `SpendLimit`

Configuration for a trailing-window spend limit.

```typescript
interface SpendLimit {
  windowMs: number;        // Window duration in milliseconds
  maxSpendUsd: number;     // Maximum spend allowed in the window
  label: string;           // Human-readable label, e.g. "24 hours"
}
```

### `SpendStatus`

Status of a single spend limit window.

```typescript
interface SpendStatus {
  limit: SpendLimit;
  spentUsd: number;        // Amount spent in the current window
  remainingUsd: number;    // How much more can be spent before hitting the limit
  exceeded: boolean;       // Whether the limit is currently exceeded
  resumesAt: Date | null;  // When the window will have enough room again
}
```

## Schema Migration

When you add new fields to your metrics schema, existing persisted state is automatically backfilled with default values. No manual migration needed.

```typescript
// Original schema
const tracker1 = await UsageTracker.create({
  key: "my-app",
  default: { api: { requests: 0 } },
});
tracker1.record({ api: { requests: 5 } });
await tracker1.save();

// Later: schema gains a new field
const tracker2 = await UsageTracker.create({
  key: "my-app",
  default: { api: { requests: 0, costUsd: 0 } }, // costUsd added
});

// Existing data is preserved, new field is backfilled
console.log(tracker2.cumulative.api.requests); // 5
console.log(tracker2.cumulative.api.costUsd);  // 0 (backfilled)
```