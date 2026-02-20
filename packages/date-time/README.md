# @hardlydifficult/date-time

A TypeScript library for human-readable duration types and millisecond conversion utilities.

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

## Time Spans and Conversion

Convert time durations to milliseconds using a strongly-typed `TimeSpan` interface.

### TimeSpan Interface

Represents a time duration with a numeric `value` and a `unit`.

```typescript
interface TimeSpan {
  value: number;
  unit: TimeUnit;
}
```

Where `TimeUnit` supports:
- `"milliseconds"`
- `"seconds"`
- `"minutes"`
- `"hours"`
- `"days"`

### toMilliseconds()

Converts a `TimeSpan` to its equivalent in milliseconds.

```typescript
import { toMilliseconds } from "@hardlydifficult/date-time";

// Minutes to milliseconds
toMilliseconds({ value: 5, unit: "minutes" }); // 300_000

// Days to milliseconds
toMilliseconds({ value: 1, unit: "days" }); // 86_400_000

// Fractional hours
toMilliseconds({ value: 0.75, unit: "hours" }); // 2_700_000
```

| Unit       | Multiplier (ms) |
|------------|-----------------|
| milliseconds | 1               |
| seconds      | 1,000           |
| minutes      | 60,000          |
| hours        | 3,600,000       |
| days         | 86,400,000      |

### Example: Duration to Milliseconds Table

| Duration                | Milliseconds |
|-------------------------|--------------|
| 1 second                | 1,000        |
| 1.5 minutes             | 90,000       |
| 2 hours                 | 7,200,000    |
| 0.5 days                | 43,200,000   |

## TimeSpan Usage Details

A strongly-typed duration representation that pairs a numeric value with a time unit, enabling human-readable time specifications that convert to milliseconds.

### Type Definition

```typescript
interface TimeSpan {
  value: number;
  unit: TimeUnit;
}

type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days';
```

### Additional Examples

```typescript
import { toMilliseconds } from '@hardlydifficult/date-time';

toMilliseconds({ value: 2, unit: 'seconds' });      // 2000
toMilliseconds({ value: 1, unit: 'hours' });        // 3600000
toMilliseconds({ value: 0.5, unit: 'seconds' });    // 500
toMilliseconds({ value: 0, unit: 'minutes' });      // 0
toMilliseconds({ value: 1, unit: 'days' });         // 86400000
```

Supports all time units (`milliseconds`, `seconds`, `minutes`, `hours`, `days`) and handles fractional values and zero correctly.