# @hardlydifficult/date-time

A TypeScript utility for converting time durations to milliseconds with strong typing.

## Installation

```bash
npm install @hardlydifficult/date-time
```

## Quick Start

```typescript
import { toMilliseconds, type TimeSpan } from "@hardlydifficult/date-time";

const duration: TimeSpan = { value: 2.5, unit: "minutes" };
const ms = toMilliseconds(duration); // 150_000
```

## TimeSpan Conversion

Converts a time duration to its equivalent in milliseconds using predefined unit multipliers.

### `TimeSpan` Interface

Represents a time duration with a numeric `value` and a `unit`.

| Field | Type     | Description          |
|-------|----------|----------------------|
| value | `number` | The numeric duration |
| unit  | `TimeUnit` | The time unit      |

### `TimeUnit` Type

Supported time units:
- `"milliseconds"`
- `"seconds"`
- `"minutes"`
- `"hours"`
- `"days"`

### `toMilliseconds(timeSpan)`

Converts a `TimeSpan` to milliseconds.

```typescript
import { toMilliseconds } from "@hardlydifficult/date-time";

// Convert 2 hours
toMilliseconds({ value: 2, unit: "hours" }); // 7_200_000

// Convert 0.5 days
toMilliseconds({ value: 0.5, unit: "days" }); // 43_200_000

// Handle fractional values
toMilliseconds({ value: 1.5, unit: "minutes" }); // 90_000
```