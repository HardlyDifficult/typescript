# @hardlydifficult/usage-tracker

Numeric usage tracking with session/cumulative dual-tracking, persistence, and spend limits.

## Installation

```bash
npm install @hardlydifficult/usage-tracker
```

## Quick Start

```typescript
import { UsageTracker } from "@hardlydifficult/usage-tracker";

const tracker = await UsageTracker.create({
  key: "my-app",
  default: {
    api: { requests: 0, tokens: 0, costUsd: 0 },
    audio: { requests: 0, durationSeconds: 0 },
  },
  stateDirectory: "./.usage-state",
});

// Record usage incrementally
tracker.record({ api: { requests: 1, tokens: 500, costUsd: 0.01 } });

// Access session and cumulative metrics
console.log(tracker.session.api.requests);        // 1
console.log(tracker.cumulative.api.tokens);       // 500
```

## Core Concepts

### Session vs. Cumulative Tracking

The `UsageTracker` maintains two separate metric trees: **session** (since last restart) and **cumulative** (all-time). The session is reset on each `create()` call, while cumulative data persists.

```typescript
const tracker = await UsageTracker.create({
  key: "session-test",
  default: { requests: 0, costUsd: 0 },
  stateDirectory: "./.state",
});

// First session
tracker.record({ requests: 3 });
expect(tracker.session.requests).toBe(3);      // 3
expect(tracker.cumulative.requests).toBe(3);   // 3

// Second session (persists cumulative, resets session)
const tracker2 = await UsageTracker.create({ /* same config */ });
expect(tracker2.session.requests).toBe(0);     // reset
expect(tracker2.cumulative.requests).toBe(3);  // preserved
```

### Cost Tracking with CostUsd Conventions

Any leaf field ending with `CostUsd` (case-insensitive) is automatically added to an internal time-series for spend-rate monitoring and limits.

```typescript
const tracker = await UsageTracker.create({
  key: "cost-test",
  default: {
    api: { requests: 0, tokens: 0, estimatedCostUsd: 0 },
    audio: { durationSeconds: 0, costUsd: 0 },
  },
});

tracker.record({
  api: { requests: 1, tokens: 500, estimatedCostUsd: 0.01 },
  audio: { durationSeconds: 30, costUsd: 0.005 },
});

// Total spend in trailing 1 hour (60,000 ms)
expect(tracker.costInWindow(60_000)).toBeCloseTo(0.015);
```

### Spend Limits and Throttling

Configure trailing-window spend limits to enforce budgets and halt usage when exceeded.

```typescript
const tracker = await UsageTracker.create({
  key: "limited",
  default: { api: { requests: 0, estimatedCostUsd: 0 } },
  stateDirectory: "./.state",
  spendLimits: [
    { windowMs: 60_000, maxSpendUsd: 1, label: "1 minute" },
    { windowMs: 3600_000, maxSpendUsd: 10, label: "1 hour" },
  ],
  onSpendLimitExceeded: (status) => {
    console.log(`Limit exceeded: ${status.limit.label}`);
  },
});

tracker.record({ api: { estimatedCostUsd: 1.5 } });

// Throws SpendLimitExceededError
tracker.assertWithinSpendLimits();
```

### Status and Resumption Time

Get detailed status of all configured limits, including when usage will resume.

```typescript
const tracker = await UsageTracker.create({
  key: "status",
  default: { api: { estimatedCostUsd: 0 } },
  spendLimits: [{ windowMs: 60_000, maxSpendUsd: 2, label: "1 minute" }],
});

tracker.record({ api: { estimatedCostUsd: 2.5 } });

const [status] = tracker.spendStatus();
expect(status.spentUsd).toBeCloseTo(2.5);
expect(status.remainingUsd).toBeCloseTo(0);
expect(status.exceeded).toBe(true);
// Time when enough old entries drop out to get back under the limit
expect(status.resumesAt).toBeInstanceOf(Date);
```

## API Reference

### UsageTracker

#### Static Methods

| Method | Description |
|--------|-------------|
| `UsageTracker.create(options)` | Create tracker, load persisted state, and start a new session. Returns a `Promise<UsageTracker<T>>`. |

#### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `session` | `Readonly<T>` | Current session metrics |
| `cumulative` | `Readonly<T>` | All-time cumulative metrics |
| `sessionStartedAt` | `string` | ISO timestamp when the current session began |
| `trackingSince` | `string` | ISO timestamp when tracking started |
| `isPersistent` | `boolean` | Whether state is persisted to disk |

#### Instance Methods

| Method | Description |
|--------|-------------|
| `record(values: DeepPartial<T>)` | Increment metrics by deeply merging values into session and cumulative trees |
| `costInWindow(windowMs: number)` | Compute total spend (USD) in a trailing window (ms) |
| `spendStatus()` | Return status for all configured spend limits |
| `assertWithinSpendLimits()` | Throw `SpendLimitExceededError` if any limit is exceeded |
| `save()` | Force-save state to disk immediately |

### Helper Utilities

#### findCostFieldPaths

Extracts dot-separated paths for all leaf fields ending in `CostUsd` (case-insensitive).

```typescript
import { findCostFieldPaths } from "@hardlydifficult/usage-tracker";

const paths = findCostFieldPaths({
  api: { estimatedCostUsd: 0, requests: 0 },
  audio: { costUsd: 0 },
});
// ["api.estimatedCostUsd", "audio.costUsd"]
```

#### extractCostFromDelta

Sums cost from a partial usage delta using known cost paths.

```typescript
import { extractCostFromDelta } from "@hardlydifficult/usage-tracker";

const cost = extractCostFromDelta(
  { api: { estimatedCostUsd: 0.05 } },
  ["api.estimatedCostUsd", "audio.costUsd"]
);
// 0.05
```

#### deepAdd

Recursively accumulates numeric values from source into target, mutating the target in place.

```typescript
import { deepAdd } from "@hardlydifficult/usage-tracker";

const target = { api: { requests: 1, costUsd: 0.01 } };
deepAdd(target, { api: { requests: 2, costUsd: 0.005 } });
// target is now { api: { requests: 3, costUsd: 0.015 } }
```

### Error Types

#### SpendLimitExceededError

```typescript
import { SpendLimitExceededError } from "@hardlydifficult/usage-tracker";

try {
  tracker.assertWithinSpendLimits();
} catch (err) {
  if (err instanceof SpendLimitExceededError) {
    console.log(err.status.spentUsd);   // spent amount
    console.log(err.status.remainingUsd); // how much more allowed
    console.log(err.status.limit.label);  // e.g. "1 minute"
    console.log(err.status.resumesAt);   // when limit will clear
  }
}
```

## Types

```typescript
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends number
    ? number
    : T[K] extends NumericRecord
      ? DeepPartial<T[K]>
      : never;
};

interface SpendLimit {
  windowMs: number;
  maxSpendUsd: number;
  label: string;
}

interface SpendStatus {
  limit: SpendLimit;
  spentUsd: number;
  remainingUsd: number;
  exceeded: boolean;
  resumesAt: Date | null;
}
```