# @hardlydifficult/throttle

Rate limiting with optional weight and state persistence.

## Installation

```bash
npm install @hardlydifficult/throttle
```

## Throttle

```typescript
import { Throttle } from '@hardlydifficult/throttle';

const throttle = new Throttle({
  unitsPerSecond: 10,
  persistKey: 'api-throttle', // optional: survives restarts
  onSleep: (ms, info) => console.log(`Sleeping ${ms}ms (weight: ${info.weight})`),
});

await throttle.wait();   // consumes 1 unit (default)
await throttle.wait(5);  // consumes 5 units
await throttle.wait(10); // consumes 10 units, sleeps if needed
```
