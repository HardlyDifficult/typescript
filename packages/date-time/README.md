# @hardlydifficult/date-time

Date and time utilities for TypeScript, providing human-readable duration types with millisecond conversion.

## Installation

```bash
npm install @hardlydifficult/date-time
```

## Quick Start

```typescript
import { toMilliseconds, type TimeSpan } from '@hardlydifficult/date-time';

const delay: TimeSpan = { value: 1.5, unit: 'minutes' };
console.log(toMilliseconds(delay)); // 90000
```

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