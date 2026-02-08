# @hardlydifficult/poller

Generic state-change poller. Polls a function at an interval and fires a callback when the result changes.

## Install

```bash
npm install @hardlydifficult/poller
```

## Usage

```typescript
import { Poller } from "@hardlydifficult/poller";

const poller = new Poller(
  async () => await fetchCurrentState(),
  (current, previous) => console.log("State changed!", current),
  5 * 60 * 1000 // poll every 5 minutes
);

await poller.start();

// Manual trigger with debounce (e.g. from a webhook)
poller.trigger(1000);

// Stop polling
poller.stop();
```

## API

### `new Poller<T>(fetchFn, onChange, intervalMs, onError?)`

| Parameter | Description |
|-----------|-------------|
| `fetchFn` | Async function that returns the current state |
| `onChange` | Called with `(current, previous)` when state changes |
| `intervalMs` | Polling interval in milliseconds |
| `onError` | Optional error handler; polling continues on errors |

| Method | Description |
|--------|-------------|
| `start()` | Start polling (fetches immediately, then at interval) |
| `stop()` | Stop polling and clean up timers |
| `trigger(debounceMs?)` | Manually trigger a poll with debounce (default 1000ms) |

### Behavior

- **Deep equality** -- uses JSON serialization to detect changes
- **Overlap prevention** -- skips a poll if the previous fetch is still running
- **Error resilience** -- continues polling after fetch errors
- **Idempotent start** -- calling `start()` multiple times is safe
