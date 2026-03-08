# @hardlydifficult/usage-tracker

Persisted usage counters with a simple API:

- `UsageTracker.open(id, metrics, options)`
- `usage.track(delta)`
- `usage.current` for this run
- `usage.total` for all runs
- `usage.spend("minute" | "hour" | "day" | "week")`
- `usage.budget` for budget status

Any metric ending in `CostUsd` is treated as spend automatically.

## Installation

```bash
npm install @hardlydifficult/usage-tracker
```

## Quick Start

```typescript
import { UsageTracker } from "@hardlydifficult/usage-tracker";

const usage = await UsageTracker.open(
  "assistant",
  {
    api: { requests: 0, tokens: 0, costUsd: 0 },
    audio: { seconds: 0 },
  },
  {
    dir: "/path/to/state",
    budget: {
      hour: 2,
      day: 10,
    },
  }
);

usage.track({
  api: { requests: 1, tokens: 1200, costUsd: 0.04 },
});

console.log(usage.current.api.requests); // 1
console.log(usage.total.api.requests); // 1
console.log(usage.spend("day")); // 0.04
console.log(usage.budget.day?.remainingUsd); // 9.96
```

## API

### `UsageTracker.open(id, metrics, options?)`

Open a tracker, load persisted totals, and start a fresh current run.

```typescript
const usage = await UsageTracker.open("my-app", {
  api: { requests: 0, tokens: 0, costUsd: 0 },
});
```

Arguments:

- `id`: persistence key
- `metrics`: zeroed metric shape
- `options.dir`: directory for persisted state
- `options.storage`: custom storage adapter
- `options.autoSaveMs`: autosave interval
- `options.budget`: budgets keyed by `minute`, `hour`, `day`, or `week`
- `options.onBudgetExceeded`: fires once when a window crosses over budget

### `usage.track(delta)`

Add numeric deltas into both `current` and `total`.

```typescript
usage.track({
  api: { requests: 1, tokens: 800, costUsd: 0.02 },
});
```

### `usage.current`

Metrics for the current process run.

### `usage.total`

Metrics across every run that used the same `id`.

### `usage.startedAt`

ISO timestamp for the current run.

### `usage.trackingSince`

ISO timestamp for when the tracker was first created.

### `usage.persistent`

Whether persistence is currently working.

### `usage.spend(window)`

Spend recorded in the trailing `minute`, `hour`, `day`, or `week`.

```typescript
const today = usage.spend("day");
const thisWeek = usage.spend("week");
```

### `usage.budget`

Live budget status keyed by window name.

```typescript
const usage = await UsageTracker.open(
  "assistant",
  {
    api: { requests: 0, costUsd: 0 },
  },
  {
    budget: { hour: 2, day: 10 },
  }
);

usage.track({ api: { costUsd: 1.5 } });

console.log(usage.budget.hour);
// {
//   window: "hour",
//   spentUsd: 1.5,
//   limitUsd: 2,
//   remainingUsd: 0.5,
//   exceeded: false,
//   resumesAt: null
// }
```

### `usage.assertBudget()`

Throw if any configured budget is exceeded.

```typescript
import {
  BudgetExceededError,
  UsageTracker,
} from "@hardlydifficult/usage-tracker";

try {
  usage.assertBudget();
} catch (error) {
  if (error instanceof BudgetExceededError) {
    console.log(error.status.window);
    console.log(error.status.spentUsd);
  }
}
```

### `usage.save()`

Force an immediate write to storage.

```typescript
await usage.save();
```

## Cost Detection

Every numeric leaf whose name ends with `CostUsd` is counted as spend.

Examples:

- `costUsd`
- `estimatedCostUsd`
- `totalCostUsd`

This works across nested metric groups:

```typescript
const usage = await UsageTracker.open("providers", {
  anthropic: { tokens: 0, estimatedCostUsd: 0 },
  openai: { tokens: 0, estimatedCostUsd: 0 },
  claudeCode: { sessions: 0, totalCostUsd: 0 },
});
```

## Types

```typescript
import type {
  Budget,
  BudgetSnapshot,
  BudgetStatus,
  BudgetWindow,
  DeepPartial,
  NumericRecord,
  UsageTrackerOpenOptions,
} from "@hardlydifficult/usage-tracker";
```
