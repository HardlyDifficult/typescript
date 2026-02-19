# @hardlydifficult/date-time

A TypeScript library providing human-readable duration types and millisecond conversion utilities.

## Installation

```bash
npm install @hardlydifficult/date-time
```

## Quick Start

```typescript
import { toMilliseconds, type TimeSpan } from "@hardlydifficult/date-time";

const duration: TimeSpan = { value: 2.5, unit: "minutes" };
console.log(toMilliseconds(duration)); // 150000
```

## Duration Conversion

The package provides a strongly-typed `TimeSpan` interface and a utility function `toMilliseconds` for converting time durations to milliseconds.

### TimeSpan Interface

Represents a time duration with a numeric value and a unit.

| Property | Type     | Description              |
|----------|----------|-------------------------|
| value    | `number` | The numeric value        |
| unit     | `TimeUnit` | The time unit of the value |

### TimeUnit Type

Supported time units:

- `"milliseconds"`
- `"seconds"`
- `"minutes"`
- `"hours"`
- `"days"`

### toMilliseconds Function

Converts a `TimeSpan` to its equivalent value in milliseconds.

```typescript
import { toMilliseconds, type TimeSpan } from "@hardlydifficult/date-time";

// Convert various durations
const durations: TimeSpan[] = [
  { value: 1, unit: "seconds" },
  { value: 0.5, unit: "hours" },
  { value: 2, unit: "days" }
];

durations.forEach(duration => {
  console.log(toMilliseconds(duration)); // 1000, 1800000, 172800000
});
```

### Example: Duration to Milliseconds Table

| Duration                | Milliseconds |
|-------------------------|--------------|
| 1 second                | 1,000        |
| 1.5 minutes             | 90,000       |
| 2 hours                 | 7,200,000    |
| 0.5 days                | 43,200,000   |

## TimeSpan

A strongly-typed duration representation that pairs a numeric value with a time unit, enabling human-readable time specifications that convert to milliseconds.

### Type Definition

```typescript
interface TimeSpan {
  value: number;
  unit: TimeUnit;
}

type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days';
```

### toMilliseconds()

Converts a `TimeSpan` to its equivalent value in milliseconds.

```typescript
import { toMilliseconds } from '@hardlydifficult/date-time';

toMilliseconds({ value: 2, unit: 'seconds' });      // 2000
toMilliseconds({ value: 1, unit: 'hours' });        // 3600000
toMilliseconds({ value: 0.5, unit: 'seconds' });    // 500
toMilliseconds({ value: 0, unit: 'minutes' });      // 0
toMilliseconds({ value: 1, unit: 'days' });         // 86400000
```

Supports all time units (`milliseconds`, `seconds`, `minutes`, `hours`, `days`) and handles fractional values and zero correctly.