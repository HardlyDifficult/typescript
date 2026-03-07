# @hardlydifficult/date-time

A small TypeScript utility for expressive durations and Unix-second timestamps.

## Installation

```bash
npm install @hardlydifficult/date-time
```

## Quick Start

```typescript
import { dateFromUnixSeconds, duration } from "@hardlydifficult/date-time";

setInterval(run, duration({ seconds: 30 }));

const maxAgeMs = duration({ days: 7 });
const createdAt = dateFromUnixSeconds("1735689600");
```

## `duration(...)`

Convert one or more duration parts into milliseconds.

```typescript
import { duration } from "@hardlydifficult/date-time";

duration({ seconds: 30 }); // 30_000
duration({ minutes: 5 }); // 300_000
duration({ minutes: 1, seconds: 30 }); // 90_000
duration({ hours: 1, minutes: 15 }); // 4_500_000
duration({ days: 7 }); // 604_800_000
```

Supported fields:

- `milliseconds`
- `seconds`
- `minutes`
- `hours`
- `days`

Behavior:

- Accepts any mix of supported fields.
- Supports fractional and negative values.
- Throws if no supported fields are provided.
- Throws if any provided value is not finite.

## `dateFromUnixSeconds(...)`

Convert a Unix timestamp in seconds to a `Date`.

```typescript
import { dateFromUnixSeconds } from "@hardlydifficult/date-time";

dateFromUnixSeconds(1735689600);
dateFromUnixSeconds("1735689600.5");
```
