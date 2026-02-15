# @hardlydifficult/teardown

Idempotent resource teardown with signal trapping. Register cleanup functions once at resource creation time — all exit paths call a single `run()`.

## Install

```bash
npm install @hardlydifficult/teardown
```

## Usage

```typescript
import { createTeardown } from "@hardlydifficult/teardown";

const teardown = createTeardown();
teardown.add(() => server.stop());
teardown.add(() => db.close());
teardown.trapSignals();

// Any manual exit path:
await teardown.run();
```

## API

### `createTeardown(): Teardown`

| Method | Description |
|--------|-------------|
| `add(fn)` | Register a teardown function. Returns an unregister function. |
| `run()` | Run all teardown functions in LIFO order. Idempotent: second call is a no-op. |
| `trapSignals()` | Wire SIGTERM/SIGINT to `run()` then `process.exit(0)`. Returns an untrap function. |

### Behavior

- **LIFO order** -- teardowns run in reverse registration order (last added runs first)
- **Idempotent** -- `run()` executes once; subsequent calls are no-ops
- **Error resilient** -- each function is wrapped in try/catch; failures don't block remaining teardowns
- **Safe unregister** -- `add()` returns an unregister function; safe to call multiple times
- **Post-run add** -- `add()` after `run()` is a silent no-op
- **Duplicate safe** -- same function added twice runs twice; unregister only removes its own registration
