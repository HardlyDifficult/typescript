# @hardlydifficult/date-time

Date and time utilities with a `TimeSpan` type for human-readable durations and precise millisecond conversion.

## Installation

```bash
npm install @hardlydifficult/date-time
```

## Usage

```typescript
import { toMilliseconds, type TimeSpan } from '@hardlydifficult/date-time';

const delay: TimeSpan = { value: 1.5, unit: 'minutes' };
toMilliseconds(delay); // 90000
```

## API Reference

### `toMilliseconds(timeSpan: TimeSpan): number`

Converts a `TimeSpan` object to its equivalent duration in milliseconds.

```typescript
import { toMilliseconds } from '@hardlydifficult/date-time';

toMilliseconds({ value: 2, unit: 'seconds' });     // 2000
toMilliseconds({ value: 0.5, unit: 'hours' });     // 1800000
toMilliseconds({ value: 1, unit: 'days' });        // 86400000
```

#### Parameters

| Name      | Type      | Description                |
|-----------|-----------|----------------------------|
| timeSpan  | `TimeSpan` | Duration object with value and unit |

### `TimeSpan` Interface

Represents a time duration with a numeric value and unit.

```typescript
const duration: TimeSpan = { value: 30, unit: 'minutes' };
```

| Property | Type      | Description                          |
|----------|-----------|--------------------------------------|
| value    | `number`  | Numeric duration value (supports fractional values) |
| unit     | `TimeUnit` | Time unit: `milliseconds`, `seconds`, `minutes`, `hours`, `days` |

### `TimeUnit` Type

Union type of supported time units.

| Unit          | Millisecond Multiplier |
|---------------|------------------------|
| milliseconds  | 1                      |
| seconds       | 1,000                  |
| minutes       | 60,000                 |
| hours         | 3,600,000              |
| days          | 86,400,000             |