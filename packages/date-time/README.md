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
console.log(toMilliseconds(duration)); // 150_000
```

## Time Spans

Represents a time duration with a numeric `value` and a `unit`, and converts it to milliseconds.

### `TimeSpan` Interface

| Field | Type      | Description          |
|-------|-----------|----------------------|
| value | `number`  | Numeric duration     |
| unit  | `TimeUnit`| Time unit identifier |

### `TimeUnit` Type

Supported units:
- `"milliseconds"`
- `"seconds"`
- `"minutes"`
- `"hours"`
- `"days"`

### `toMilliseconds`

Converts a `TimeSpan` to its equivalent value in milliseconds.

```typescript
import { toMilliseconds } from "@hardlydifficult/date-time";

toMilliseconds({ value: 1, unit: "hours" });   // 3_600_000
toMilliseconds({ value: 0.5, unit: "days" });  // 43_200_000
toMilliseconds({ value: 120, unit: "seconds" }); // 120_000
```

#### Additional Examples

```typescript
// Seconds to milliseconds
toMilliseconds({ value: 2, unit: "seconds" }); // 2_000

// Minutes to milliseconds (fractional value)
toMilliseconds({ value: 1.5, unit: "minutes" }); // 90_000

// Days to milliseconds
toMilliseconds({ value: 1, unit: "days" }); // 86_400_000

// Fractional value
toMilliseconds({ value: 0.5, unit: "seconds" }); // 500

// Zero duration
toMilliseconds({ value: 0, unit: "hours" }); // 0
```