# @hardlydifficult/usage-tracker

Tracks numeric usage metrics with automatic session vs. cumulative dual-tracking, cost (USD) monitoring, and optional spend limits with trailing windows.

## Installation

```bash
npm install @hardlydifficult/usage-tracker
```

## Usage

```typescript
import { UsageTracker } from "@hardlydifficult/usage-tracker";

// Create tracker with default metrics — type inferred automatically
const tracker = await UsageTracker.create({
  key: "my-usage",
  default: {
    api: { requests: 0, tokens: 0, costUsd: 0 },
    audio: { requests: 0, durationSeconds: 0 },
  },
});

// Record metrics — deeply adds to both session and cumulative counters
tracker.record({ api: { requests: 1, tokens: 500, costUsd: 0.01 } });

// Read session and cumulative state
console.log(tracker.session.api.requests);        // 1
console.log(tracker.cumulative.api.tokens);       // 500
console.log(tracker.sessionStartedAt);            // e.g., "2024-01-01T00:00:00.000Z"
console.log(tracker.trackingSince);               // e.g., "2024-01-01T00:00:00.000Z"
console.log(tracker.isPersistent);                // true if state saved to disk
```

## API Reference

### UsageTracker

#### `UsageTracker.create<T>(options): Promise<UsageTracker<T>>`

Creates a new tracker, loads persisted state, and starts a new session.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `key` | `string` | Yes | Unique persistence key (alphanumeric, hyphens, underscores) |
| `default` | `T` | Yes | Default metrics shape — all leaves must be 0 |
| `stateDirectory` | `string` | No | Directory for state files |
| `autoSaveMs` | `number` | No | Auto-save interval in ms |
| `onEvent` | `(event) => void` | No | Logging callback for state changes |
| `spendLimits` | `SpendLimit[]` | No | Trailing-window spend limits |
| `onSpendLimitExceeded` | `(status) => void` | No | Callback when spend limit is exceeded |

**Example:**
```typescript
const tracker = await UsageTracker.create({
  key: "usage-2024",
  default: { api: { requests: 0, tokens: 0, costUsd: 0 } },
  stateDirectory: "/path/to/state",
  autoSaveMs: 5000,
  spendLimits: [
    { windowMs: 60_000, maxSpendUsd: 5, label: "1 minute" },
  ],
});
```

#### `tracker.record(values): void`

Deeply adds numeric values to both session and cumulative counters. Only provide the fields you are incrementing.

**Example:**
```typescript
tracker.record({ api: { requests: 1, tokens: 500 } });
// api.costUsd remains unchanged
```

#### `tracker.save(): Promise<void>`

Force-saves current state to disk immediately.

**Example:**
```typescript
await tracker.save();
```

#### Getters

| Getter | Type | Description |
|--------|------|-------------|
| `session` | `Readonly<T>` | Current session metrics |
| `cumulative` | `Readonly<T>` | All-time metrics |
| `sessionStartedAt` | `string` | ISO timestamp of session start |
| `trackingSince` | `string` | ISO timestamp of first tracking |
| `isPersistent` | `boolean` | Whether data persists to disk |

#### `tracker.costInWindow(windowMs): number`

Total cost (USD) recorded within a trailing window.

**Example:**
```typescript
const last5MinCost = tracker.costInWindow(5 * 60_000);
console.log(last5MinCost); // e.g., 2.75
```

#### `tracker.spendStatus(): SpendStatus[]`

Get status of all configured spend limits.

**Example:**
```typescript
const statuses = tracker.spendStatus();
// [{ limit: {...}, spentUsd: 2.5, remainingUsd: 2.5, exceeded: false, resumesAt: null }]
```

#### `tracker.assertWithinSpendLimits(): void`

Throws `SpendLimitExceededError` if any configured limit is exceeded.

**Example:**
```typescript
try {
  tracker.assertWithinSpendLimits();
} catch (err) {
  console.error(err.message);
  // Spend limit exceeded: $3.00 spent in trailing 1 minute (limit: $2.50)
}
```

### SpendLimitExceededError

Custom error thrown when a configured spend limit is exceeded.

**Example:**
```typescript
import { UsageTracker, SpendLimitExceededError } from "@hardlydifficult/usage-tracker";

const tracker = await UsageTracker.create({
  key: "limited",
  default: { api: { requests: 0, costUsd: 0 } },
  spendLimits: [{ windowMs: 60_000, maxSpendUsd: 1, label: "1 minute" }],
});

tracker.record({ api: { costUsd: 1.5 } });

try {
  tracker.assertWithinSpendLimits();
} catch (err) {
  if (err instanceof SpendLimitExceededError) {
    console.log(err.status.spentUsd); // 1.5
    console.log(err.status.remainingUsd); // 0
    console.log(err.status.resumesAt); // Date when window will have enough room
  }
}
```

### Utilities

#### `deepAdd(target, source): void`

Recursively adds numeric values from source into target. Mutates target in place. Only adds to existing keys in target.

**Example:**
```typescript
import { deepAdd } from "@hardlydifficult/usage-tracker";

const totals = { api: { requests: 5, tokens: 1000 } };
deepAdd(totals, { api: { requests: 1, tokens: 500 } });
// totals is now { api: { requests: 6, tokens: 1500 } }
```

#### `findCostFieldPaths(record): string[]`

Returns dot-separated paths to all fields ending with "CostUsd" (case-insensitive).

**Example:**
```typescript
import { findCostFieldPaths } from "@hardlydifficult/usage-tracker";

const paths = findCostFieldPaths({
  api: { estimatedCostUsd: 0, tokens: 0 },
  claudeCode: { totalCostUsd: 0 },
});
console.log(paths); // ["api.estimatedCostUsd", "claudeCode.totalCostUsd"]
```

#### `extractCostFromDelta(delta, costPaths): number`

Extracts the total cost from a partial delta by summing values at given cost paths.

**Example:**
```typescript
import { extractCostFromDelta, findCostFieldPaths } from "@hardlydifficult/usage-tracker";

const delta = { api: { estimatedCostUsd: 0.5 }, audio: { durationSeconds: 120 } };
const costPaths = findCostFieldPaths(delta);
const cost = extractCostFromDelta(delta, costPaths);
console.log(cost); // 0.5
```

### Types

```typescript
interface NumericRecord {
  [key: string]: number | NumericRecord;
}

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

interface SpendEntry {
  timestamp: number;
  amountUsd: number;
}

interface PersistedUsageState<T extends NumericRecord> {
  cumulative: T;
  session: T;
  trackingSince: string;
  sessionStartedAt: string;
  spendEntries: SpendEntry[];
}
```