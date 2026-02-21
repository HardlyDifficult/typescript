# @hardlydifficult/usage-tracker

Numeric usage tracking with session/cumulative dual-tracking, persistence, and spend limits.

## Installation

```bash
npm install @hardlydifficult/usage-tracker
```

## Quick Start

```typescript
import { UsageTracker } from "@hardlydifficult/usage-tracker";

const defaults = {
  api: { requests: 0, tokens: 0, costUsd: 0 },
  audio: { requests: 0, durationSeconds: 0 },
};

const tracker = await UsageTracker.create({
  key: "my-app",
  default: defaults,
  stateDirectory: "./state",
});

// Record usage for a session
tracker.record({ api: { requests: 1, tokens: 500, costUsd: 0.01 } });

// Access metrics
console.log(tracker.session.api.requests); // 1
console.log(tracker.cumulative.api.requests); // 1

// Save state to disk
await tracker.save();
```

## Core Concepts

### Usage Tracking

Tracks numeric metrics across two timeframes: **session** (since last `create()`) and **cumulative** (all-time). Both are updated atomically on every `record()` call.

```typescript
// Record a partial delta — only specify the fields you're incrementing
tracker.record({ api: { requests: 1, tokens: 100 } });

// Unspecified fields remain unchanged
expect(tracker.session.api.costUsd).toBe(0); // unchanged
```

### Cost Tracking

Any leaf field ending in `CostUsd` (case-insensitive) is automatically detected and recorded in a time-series for spend monitoring.

```typescript
const defaults = {
  anthropic: { estimatedCostUsd: 0, requests: 0 },
  openai: { costUsd: 0, tokens: 0 },
};

const tracker = await UsageTracker.create({ key: "cost-test", default: defaults });
tracker.record({ anthropic: { estimatedCostUsd: 0.05 }, openai: { costUsd: 0.01 } });

expect(tracker.costInWindow(60_000)).toBeCloseTo(0.06);
```

### Spend Limits

Define trailing-window spend limits and optionally handle violations via a callback or exception.

```typescript
const tracker = await UsageTracker.create({
  key: "limits-test",
  default: { api: { estimatedCostUsd: 0 } },
  spendLimits: [{ windowMs: 60_000, maxSpendUsd: 5, label: "1 minute" }],
  onSpendLimitExceeded: (status) => {
    console.warn(`Limit exceeded! Resumes at ${status.resumesAt}`);
  },
});

tracker.record({ api: { estimatedCostUsd: 6 } });

// Throws SpendLimitExceededError
tracker.assertWithinSpendLimits();
```

### State Persistence

State is persisted to disk and restored across restarts. Sessions reset automatically, but cumulative totals are preserved.

```typescript
// First run
const tracker1 = await UsageTracker.create({ key: "persist", default: { a: 0 } });
tracker1.record({ a: 5 });
await tracker1.save();

// Second run (cumulative preserved, session reset)
const tracker2 = await UsageTracker.create({ key: "persist", default: { a: 0 } });
expect(tracker2.cumulative.a).toBe(5);
expect(tracker2.session.a).toBe(0);
```

## API Reference

### UsageTracker

Tracks usage metrics and cost (USD) with session/cumulative tracking, spend limits, and persistence.

#### Static Methods

| Method | Description |
|--------|-------------|
| `UsageTracker.create(options)` | Initialize tracker, load persisted state, and start a new session |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `session` | `Readonly<T>` | Current session metrics |
| `cumulative` | `Readonly<T>` | All-time cumulative metrics |
| `sessionStartedAt` | `string` | ISO timestamp for session start |
| `trackingSince` | `string` | ISO timestamp for when tracking began |
| `isPersistent` | `boolean` | Whether state is persisted to disk |

#### Methods

| Method | Description |
|--------|-------------|
| `record(values: DeepPartial<T>)` | Increment session and cumulative metrics |
| `costInWindow(windowMs: number)` | Get total cost (USD) in a trailing window |
| `spendStatus()` | Get status for all configured spend limits |
| `assertWithinSpendLimits()` | Throw if any limit is exceeded |
| `save()` | Force-save current state to disk |

### SpendLimitExceededError

Custom error thrown when a spend limit is exceeded.

```typescript
try {
  tracker.assertWithinSpendLimits();
} catch (err) {
  if (err instanceof SpendLimitExceededError) {
    console.log(err.status.spentUsd, err.status.remainingUsd);
  }
}
```

### Utility Functions

| Function | Description |
|----------|-------------|
| `findCostFieldPaths(obj)` | Extract dot-separated paths for all `*CostUsd` fields |
| `extractCostFromDelta(delta, paths)` | Sum cost values from a partial delta |
| `deepAdd(target, source)` | Recursively add numeric values (mutates target) |

### Types

| Type | Description |
|------|-------------|
| `NumericRecord` | Nested object with only `number` leaves |
| `DeepPartial<T>` | Recursive partial — omit unchanged nested fields |
| `SpendLimit` | Trailing-window limit: `{ windowMs, maxSpendUsd, label }` |
| `SpendStatus` | Current status: `{ limit, spentUsd, remainingUsd, exceeded, resumesAt }` |
| `SpendEntry` | Timestamped spend entry: `{ timestamp, amountUsd }` |
| `UsageTrackerOptions<T>` | Configuration passed to `create()` |

### Options

```typescript
interface UsageTrackerOptions<T extends NumericRecord> {
  key: string; // Unique persistence key (alphanumeric, hyphens, underscores)
  default: T; // Default metrics shape (all leaves must be 0)
  stateDirectory?: string; // Directory for state persistence
  autoSaveMs?: number; // Auto-save interval in ms (passed to StateTracker)
  onEvent?: (event: StateTrackerEvent) => void; // Logging callback
  spendLimits?: readonly SpendLimit[]; // Trailing-window spend limits
  onSpendLimitExceeded?: (status: SpendStatus) => void; // Exceeded callback
}
```