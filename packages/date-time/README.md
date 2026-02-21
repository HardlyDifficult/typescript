# @hardlydifficult/date-time

A TypeScript library for representing time durations and converting them to milliseconds.

## Installation

```bash
npm install @hardlydifficult/date-time
```

## Quick Start

```typescript
import { toMilliseconds, type TimeSpan } from "@hardlydifficult/date-time";

const duration: TimeSpan = { value: 2.5, unit: "minutes" };
const milliseconds = toMilliseconds(duration);
// => 150000
```

## Time Duration Conversion

### toMilliseconds

Converts a `TimeSpan` to its equivalent value in milliseconds.

```typescript
import { toMilliseconds, type TimeSpan } from "@hardlydifficult/date-time";

// Seconds
toMilliseconds({ value: 5, unit: "seconds" }); // => 5000

// Minutes
toMilliseconds({ value: 1.5, unit: "minutes" }); // => 90000

// Hours
toMilliseconds({ value: 1, unit: "hours" }); // => 3600000

// Days
toMilliseconds({ value: 1, unit: "days" }); // => 86400000

// Fractional values
toMilliseconds({ value: 0.5, unit: "seconds" }); // => 500
```

### TimeSpan Interface

Represents a duration with a numeric value and a unit.

| Property | Type     | Description             |
|----------|----------|-------------------------|
| value    | `number` | The numeric duration    |
| unit     | `TimeUnit` | The time unit (see below) |

### TimeUnit Type

Supported time units:

- `"milliseconds"`
- `"seconds"`
- `"minutes"`
- `"hours"`
- `"days"`