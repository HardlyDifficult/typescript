# @hardlydifficult/throttle

Rate limiting utilities with optional state persistence.

## Installation

```bash
npm install @hardlydifficult/throttle @hardlydifficult/state-tracker
```

## Usage

### Throttle

Simple throttle that enforces a minimum delay between operations.

```typescript
import { Throttle } from '@hardlydifficult/throttle';

const throttle = new Throttle({
  minimumDelayMs: 1000, // 1 second between operations
  onSleep: (ms) => console.log(`Waiting ${ms}ms`),
});

// Wait before each operation
await throttle.wait();
await fetch('/api/data');

await throttle.wait(); // Waits if needed
await fetch('/api/more');
```

### WeightedThrottle

Rate limiter where each operation has a cost/weight.

```typescript
import { WeightedThrottle } from '@hardlydifficult/throttle';

const throttle = new WeightedThrottle({
  unitsPerSecond: 100, // Max 100 units per second
  persistKey: 'myapp-api-throttle', // Optional: persist across restarts
  stateDirectory: '/path/to/state', // Optional: custom state directory
  onSleep: (ms, info) => {
    console.log(`Waiting ${ms}ms for ${info.weight} units`);
  },
});

// Process items with rate limiting
for (const batch of batches) {
  await throttle.wait(batch.length); // Wait based on batch size
  await processBatch(batch);
}
```

## Features

- **Simple Throttle**: Enforces minimum delay between operations
- **Weighted Throttle**: Rate limiting with per-operation cost
- **State Persistence**: Optionally persist rate limit state across restarts
- **Callbacks**: Get notified when throttle needs to wait

## Peer Dependencies

This package requires `@hardlydifficult/state-tracker` for the `WeightedThrottle` persistence feature.
