# @hardlydifficult/throttle

Rate limiting utilities with optional state persistence.

## Installation

```bash
npm install @hardlydifficult/throttle
```

## Throttle

Delay-based rate limiting with human-readable durations and optional state persistence across restarts.

```typescript
import { Throttle } from '@hardlydifficult/throttle';

const throttle = new Throttle({
  minimumDelay: { value: 1.5, unit: 'minutes' },
  persistKey: 'my-throttle', // optional: survives restarts
  onSleep: (ms) => console.log(`Sleeping ${ms}ms`),
});

await throttle.wait(); // resolves immediately
await throttle.wait(); // sleeps 90s before resolving
```

## WeightedThrottle

Per-operation weight support with optional state persistence across restarts.

```typescript
import { WeightedThrottle } from '@hardlydifficult/throttle';

const throttle = new WeightedThrottle({
  unitsPerSecond: 10,
  persistKey: 'api-throttle', // optional: survives restarts
  onSleep: (ms, info) => console.log(`Sleeping ${ms}ms (weight: ${info.weight})`),
});

await throttle.wait(5);  // consumes 5 units
await throttle.wait(10); // consumes 10 units, sleeps if needed
```
