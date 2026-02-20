# @hardlydifficult/daemon

Opinionated utilities for long-running scripts and services:

- `createTeardown()` for idempotent cleanup
- `runContinuousLoop()` for daemon-style cycle execution with graceful shutdown

## Installation

```bash
npm install @hardlydifficult/daemon
```

## createTeardown

Register teardown functions once and call `run()` from every exit path.

```typescript
import { createTeardown } from "@hardlydifficult/daemon";

const teardown = createTeardown();
teardown.add(() => server.stop());
teardown.add(() => db.close());
teardown.trapSignals();

await teardown.run();
```

Behavior:

- LIFO execution (last added, first run)
- Idempotent `run()` (safe to call multiple times)
- Per-function error isolation (one failing teardown does not block others)
- `add()` returns an unregister function

## runContinuousLoop

Run a cycle repeatedly with SIGINT/SIGTERM handling, optional per-cycle delay
control, and hook-based error policy.

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
      return 60_000; // wait 60s before next cycle
    }

    return "immediate"; // run next cycle without sleeping
  },
  onCycleError(error, context) {
    notifyOps(error, { cycleNumber: context.cycleNumber });
    return "continue"; // or "stop"
  },
});
```

### Cycle return contract

`runCycle()` can return:

- `void`/any value: use default `intervalSeconds`
- `number`: use that delay in milliseconds
- `"immediate"`: skip sleep and run next cycle immediately
- `{ stop: true }`: finish loop gracefully
- `{ nextDelayMs: number | "immediate", stop?: true }`: explicit control object

### Optional delay resolver

If your cycle returns domain data, keep it clean and derive delays with
`getNextDelayMs(result, context)`.

### Error handling

Use `onCycleError(error, context)` to route errors to your own systems
(Slack/Sentry/etc.) and decide whether to `"continue"` or `"stop"`.

Without `onCycleError`, errors are logged and the loop continues.

### Logger injection

By default, warnings/errors use `console.warn`/`console.error`.
Provide `logger` to plug in your own logging implementation:

```typescript
const logger = {
  warn: (message, context) => myLogger.warn(message, context),
  error: (message, context) => myLogger.error(message, context),
};
```
