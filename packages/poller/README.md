I'll inspect the source files to understand the package structure and API, then generate a comprehensive README.Now I have all the information I need. Let me generate the comprehensive README.

# @hardlydifficult/poller

Polls an async function at a configurable interval, detects state changes via JSON deep equality, and triggers callbacks on changes or manual triggers.

## Install

```bash
npm install @hardlydifficult/poller
```

## Usage

### Basic Example

```typescript
import { Poller } from "@hardlydifficult/poller";

const poller = new Poller(
  async () => {
    const response = await fetch("/api/status");
    return response.json();
  },
  (current, previous) => {
    console.log("State changed!", current);
  },
  5 * 60 * 1000 // poll every 5 minutes
);

await poller.start();
```

### With Error Handling

```typescript
import { Poller } from "@hardlydifficult/poller";

const poller = new Poller(
  async () => await fetchData(),
  (current, previous) => console.log("Changed:", current),
  10 * 1000, // 10 seconds
  (error) => console.error("Fetch failed:", error)
);

await poller.start();
```

### Manual Trigger

```typescript
// Trigger an immediate poll with debounce (useful for webhooks)
poller.trigger(1000); // debounce 1 second

// Stop polling
poller.stop();
```

## API Reference

### `Poller<T>`

Generic polling utility that periodically fetches data and invokes a callback when the result changes.

#### Constructor

```typescript
new Poller<T>(
  fetchFn: () => Promise<T>,
  onChange: (current: T, previous: T | undefined) => void,
  intervalMs: number,
  onError?: (error: unknown) => void
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `fetchFn` | `() => Promise<T>` | Async function that returns the current state |
| `onChange` | `(current: T, previous: T \| undefined) => void` | Called with `(current, previous)` when state changes |
| `intervalMs` | `number` | Polling interval in milliseconds |
| `onError` | `(error: unknown) => void` | Optional error handler; polling continues on errors |

#### Methods

##### `start(): Promise<void>`

Start polling. Fetches immediately, then at the configured interval.

```typescript
const poller = new Poller(
  async () => ({ count: 42 }),
  (current) => console.log("Current:", current),
  5000
);

await poller.start();
// Logs: "Current: { count: 42 }" immediately
// Then logs again every 5 seconds if data changes
```

##### `stop(): void`

Stop polling and clean up all timers.

```typescript
poller.stop();
// No more polls will fire
// Pending debounced triggers are cancelled
```

##### `trigger(debounceMs?: number): void`

Manually trigger a poll with debounce. Useful for responding to external events like webhooks. Default debounce is 1000ms.

```typescript
const poller = new Poller(
  async () => await fetchStatus(),
  (current) => console.log("Status:", current),
  60 * 1000
);

await poller.start();

// Webhook received — trigger immediate poll with 500ms debounce
poller.trigger(500);

// Multiple rapid triggers are debounced into one poll
poller.trigger(500);
poller.trigger(500);
// Only one additional poll fires after 500ms
```

**Note:** `trigger()` does nothing if the poller is not running.

## Behavior

- **Deep equality** — Uses JSON serialization to detect changes. Structurally equal objects are considered unchanged even if they're different references.
- **Overlap prevention** — Skips a poll if the previous fetch is still running, preventing concurrent requests.
- **Error resilience** — Continues polling after fetch errors. If `onError` is provided, it's called with the error.
- **Idempotent start** — Calling `start()` multiple times is safe; only the first call starts polling.
- **Debounced triggers** — Multiple `trigger()` calls within the debounce window are coalesced into a single poll.