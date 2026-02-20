# @hardlydifficult/daemon

Opinionated utilities for long-running Node.js services:

- `createTeardown()` for idempotent cleanup with signal trapping
- `runContinuousLoop()` for daemon-style cycle execution

## Installation

```bash
npm install @hardlydifficult/daemon
```

## Teardown management

Use `createTeardown()` to register cleanup functions once and execute them from
every exit path.

```typescript
import { createTeardown } from "@hardlydifficult/daemon";

const teardown = createTeardown();
teardown.add(() => server.stop());
teardown.add(async () => {
  await db.close();
});
teardown.trapSignals();

await teardown.run();
```

Behavior:

- LIFO execution (last added, first run)
- Idempotent `run()` (safe to call multiple times)
- Per-function error isolation (one failing teardown does not block others)
- `add()` returns an unregister function

## Continuous loop execution

Use `runContinuousLoop()` to run work cycles with graceful shutdown, dynamic
delay control, and configurable error policy.

```typescript
import { runContinuousLoop } from "@hardlydifficult/daemon";

await runContinuousLoop({
  intervalSeconds: 30,
  async runCycle(isShutdownRequested) {
    if (isShutdownRequested()) {
      return { stop: true };
    }

    const didWork = await syncQueue();
    if (!didWork) {
      return 60_000; // ms
    }

    return "immediate";
  },
  onCycleError(error, context) {
    notifyOps(error, { cycleNumber: context.cycleNumber });
    return "continue"; // or "stop"
  },
});
```

### Cycle return contract

`runCycle()` can return:

- any value/`undefined`: use default `intervalSeconds`
- `number`: use that delay in milliseconds
- `"immediate"`: run the next cycle without sleeping
- `{ stop: true }`: stop gracefully after current cycle
- `{ nextDelayMs: number | "immediate", stop?: true }`: explicit control object

### Optional delay resolver

If your cycle returns domain data, derive schedule policy with
`getNextDelayMs(result, context)`.

### Error handling

Use `onCycleError(error, context)` to route to Slack/Sentry and decide whether
to `"continue"` or `"stop"`. Without this hook, cycle errors are logged and the
loop continues.

### Logger injection

By default, warnings and errors use `console.warn` and `console.error`. Pass
`logger` to integrate your own logging implementation:

```typescript
const logger = {
  warn: (message, context) => myLogger.warn(message, context),
  error: (message, context) => myLogger.error(message, context),
};
```
