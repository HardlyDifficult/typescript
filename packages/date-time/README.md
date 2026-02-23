# @hardlydifficult/date-time

A TypeScript utility for converting time durations to milliseconds with strong typing.

## Installation

```bash
npm install @hardlydifficult/date-time
```

## Quick Start

```typescript
import { toMilliseconds, type TimeSpan } from "@hardlydifficult/date-time";

const duration: TimeSpan = { value: 2, unit: "minutes" };
const milliseconds = toMilliseconds(duration); // 120_000
```

## TimeSpan Conversion

Converts a time duration (represented as a `TimeSpan`) to its equivalent value in milliseconds.

### Interface

| Property | Type     | Description                |
|----------|----------|----------------------------|
| `value`  | `number` | The numeric value of time  |
| `unit`   | `TimeUnit` | The time unit (see below) |

### TimeUnit Options

- `"milliseconds"`
- `"seconds"`
- `"minutes"`
- `"hours"`
- `"days"`

### Function

```typescript
toMilliseconds(timeSpan: TimeSpan): number
```

Converts the given time span to milliseconds using predefined unit multipliers.

### Examples

```typescript
import { toMilliseconds } from "@hardlydifficult/date-time";

// Seconds to milliseconds
toMilliseconds({ value: 2, unit: "seconds" }); // 2_000

// Minutes to milliseconds
toMilliseconds({ value: 1.5, unit: "minutes" }); // 90_000

// Days to milliseconds
toMilliseconds({ value: 1, unit: "days" }); // 86_400_000

// Fractional value
toMilliseconds({ value: 0.5, unit: "seconds" }); // 500

// Zero duration
toMilliseconds({ value: 0, unit: "hours" }); // 0
```