# @hardlydifficult/usage-tracker

Usage tracker with session/cumulative dual-tracking, cost monitoring, spend limits, and disk persistence.

## Installation

```bash
npm install @hardlydifficult/usage-tracker
```

## Quick Start

```typescript
import { UsageTracker } from "@hardlydifficult/usage-tracker";

// Define your metrics shape — any leaf ending in "CostUsd" is tracked for spend monitoring
const defaults = {
  api: { requests: 0, tokens: 0, costUsd: 0 },
  audio: { durationSeconds: 0 },
};

// Create a tracker that persists state to disk
const tracker = await UsageTracker.create({
  key: "my-app",
  default: defaults,
  stateDirectory: "/path/to/state",
});

// Record usage — both session and cumulative metrics are incremented
tracker.record({ api: { requests: 1, tokens: 1000, costUsd: 0.05 } });

// Check session vs. cumulative metrics
console.log(tracker.session.api.requests);   // 1 (session only)
console.log(tracker.cumulative.api.requests); // 1 (all-time)
```

## Core Features

### Session and Cumulative Tracking

The tracker maintains two metric views: `session` (since last start) and `cumulative` (all-time). Both are updated simultaneously on `record()`.

#### Properties

| Property | Type | Description |
|---|---|---|
| `session` | `Readonly<T>` | Current session metrics |
| `cumulative` | `Readonly<T>` | All-time metrics |
| `sessionStartedAt` | `string` | ISO timestamp when the current session started |
| `trackingSince` | `string` | ISO timestamp when cumulative tracking began |
| `isPersistent` | `boolean` | Whether state is persisted to disk |

```typescript
const tracker = await UsageTracker.create({
  key: "example",
  default: { api: { requests: 0 } },
  stateDirectory: "/tmp",
});

tracker.record({ api: { requests: 1 } });
console.log(tracker.session.api.requests);   // 1
console.log(tracker.cumulative.api.requests); // 1

// After process restart, session resets but cumulative persists
const tracker2 = await UsageTracker.create({
  key: "example",
  default: { api: { requests: 0 } },
  stateDirectory: "/tmp",
});
console.log(tracker2.session.api.requests);   // 0
console.log(tracker2.cumulative.api.requests); // 1
```

### Persistence

State is automatically persisted to disk and survives restarts. Use `save()` to force immediate writes.

```typescript
await tracker.save();
```

### Record Method

```typescript
record(values: DeepPartial<T>): void;
```

Record metrics by deeply adding numeric values to both session and cumulative. Only provide the fields you are incrementing — unspecified fields are unchanged.

```typescript
tracker.record({ api: { requests: 1 } }); // increments only `requests`
tracker.record({ api: { costUsd: 0.01 } }); // also tracks cost if field name ends with "CostUsd"
```

## Cost Monitoring

Any leaf field ending with `costusd` (case-insensitive, e.g., `costUsd`, `estimatedCostUsd`, `totalCostUsd`) is automatically tracked in a time-series for spend monitoring.

### Cost Field Detection

```typescript
import { findCostFieldPaths } from "@hardlydifficult/usage-tracker";

const paths = findCostFieldPaths({
  anthropic: { estimatedCostUsd: 0, tokens: 0 },
  claudeCode: { totalCostUsd: 0 },
});
// ["anthropic.estimatedCostUsd", "claudeCode.totalCostUsd"]
```

### Extract Cost from Delta

```typescript
import { extractCostFromDelta } from "@hardlydifficult/usage-tracker";

const cost = extractCostFromDelta(
  { api: { estimatedCostUsd: 0.05 }, code: { totalCostUsd: 1.5 } },
  ["api.estimatedCostUsd", "code.totalCostUsd"]
);
// 1.55
```

### Trailing Window Cost

```typescript
costInWindow(windowMs: number): number;
```

Get total cost (USD) recorded within a trailing window.

```typescript
// Last 24 hours
const dailySpend = tracker.costInWindow(24 * 60 * 60 * 1000);
```

## Spend Limits

Configure trailing-window spend limits to enforce budgets. Limits automatically track `costUsd` fields and prune stale entries.

### Configuration

| Option | Type | Description |
|---|---|---|
| `windowMs` | `number` | Window duration in milliseconds |
| `maxSpendUsd` | `number` | Maximum spend allowed in the window |
| `label` | `string` | Human-readable label (e.g., `"24 hours"`) |

### Usage

```typescript
const tracker = await UsageTracker.create({
  key: "my-app",
  default: {
    api: { requests: 0, costUsd: 0 },
    code: { sessions: 0, totalCostUsd: 0 },
  },
  stateDirectory: "/tmp",
  spendLimits: [
    { windowMs: 24 * 60 * 60 * 1000, maxSpendUsd: 10, label: "24 hours" },
    { windowMs: 60 * 60 * 1000, maxSpendUsd: 2, label: "1 hour" },
  ],
  onSpendLimitExceeded: (status) => {
    console.log(`Limit exceeded: ${status.spentUsd.toFixed(2)} / $${status.limit.maxSpendUsd}`);
  },
});

tracker.record({ api: { costUsd: 12 } });

try {
  tracker.assertWithinSpendLimits();
} catch (err) {
  if (err instanceof SpendLimitExceededError) {
    console.log(err.message);
    // Spend limit exceeded: $12.00 spent in trailing 24 hours (limit: $10.00)
  }
}
```

### Status Queries

```typescript
spendStatus(): SpendStatus[];
```

Get status of all configured limits.

| Field | Type | Description |
|---|---|---|
| `spentUsd` | `number` | Amount spent in the current window |
| `remainingUsd` | `number` | How much more can be spent before hitting the limit |
| `exceeded` | `boolean` | Whether the limit is currently exceeded |
| `resumesAt` | `Date \| null` | When the window will have enough room again |

```typescript
const statuses = tracker.spendStatus();
for (const status of statuses) {
  console.log(`${status.limit.label}: $${status.spentUsd.toFixed(2)} / $${status.limit.maxSpendUsd.toFixed(2)}`);
}
```

## Utility Functions

### deepAdd

```typescript
deepAdd(target: T, source: DeepPartial<T>): void;
```

Recursively adds numeric values from `source` into `target`, mutating `target` in place.

```typescript
const target = { api: { requests: 1 } };
deepAdd(target, { api: { requests: 2, costUsd: 0.01 } });
console.log(target); // { api: { requests: 3, costUsd: 0.01 } }
```

### findCostFieldPaths

```typescript
findCostFieldPaths(obj: NumericRecord): string[];
```

Returns an array of dot-notation paths to all leaf fields ending in `CostUsd` (case-insensitive).

### extractCostFromDelta

```typescript
extractCostFromDelta(delta: DeepPartial<T>, paths: string[]): number;
```

Sums cost values from a delta object using provided paths.

## Error Handling

### SpendLimitExceededError

```typescript
class SpendLimitExceededError extends Error {
  readonly status: SpendStatus;
  constructor(status: SpendStatus);
}
```

Thrown when a spend limit is exceeded and `assertWithinSpendLimits()` is called.

```typescript
try {
  tracker.assertWithinSpendLimits();
} catch (err) {
  if (err instanceof SpendLimitExceededError) {
    console.log(err.status.spentUsd);  // Amount spent
    console.log(err.status.remainingUsd); // 0 (exceeded)
  }
}
```

## Types

```typescript
import type {
  NumericRecord,
  DeepPartial,
  SpendLimit,
  SpendStatus,
  SpendEntry,
} from "@hardlydifficult/usage-tracker";

// Constrain T to a nested object where every leaf is a number
interface NumericRecord {
  [key: string]: number | NumericRecord;
}

// Recursive partial — only provide the fields you are incrementing
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends number
    ? number
    : T[K] extends NumericRecord
      ? DeepPartial<T[K]>
      : never;
};

// A single timestamped spend entry
interface SpendEntry {
  timestamp: number;
  amountUsd: number;
}
```