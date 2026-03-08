# @hardlydifficult/logger

Opinionated structured logging with strong defaults.

Use `createLogger()` for application logs. The preferred path is short on purpose: name the scope once, turn on the outputs you want, and log plain runtime data. The low-level plugin API still exists, but it is the escape hatch.

## Installation

```bash
npm install @hardlydifficult/logger
```

## Preferred API

```typescript
import { createLogger } from "@hardlydifficult/logger";

const logger = createLogger("payments", {
  file: "./logs/app.jsonl",
  alert: (message) => {
    // POST to your Discord webhook here
  },
});

logger.info("service started", { port: 3000 });
```

### Strong defaults

- Console logging is on by default.
- Default level is `info`.
- The string shorthand binds `{ scope: "..." }` into every entry.
- Alert senders only receive `warn`, `error`, and `alert()` messages.
- File output is JSONL, one entry per line.
- Context is serialized safely by default.

That means clients can pass real runtime values without defensive formatting:

```typescript
try {
  await chargeCustomer();
} catch (error) {
  logger.error("charge failed", { error, attempt: 2n });
}
```

`Error` objects become structured data, `bigint` values become strings, and circular references are replaced with `"[Circular]"` instead of breaking the log write.

## Bind Context Once

Business code should not repeat infrastructure metadata on every call.

```typescript
const orderLogger = logger.child({
  orderId: "ord_123",
  customerId: "cus_456",
});

orderLogger.info("charge requested", { amountCents: 4999 });
orderLogger.info("receipt sent");
```

Per-call context is merged with bound context. If keys overlap, the per-call value wins.

## Alerts

Use `alert()` for out-of-band messages that should bypass normal log levels.

```typescript
logger.alert("manual intervention required");
```

When `alert` is configured, `alert()` sends the message directly to the sender.

## API

### `createLogger(scope?, options?)`

```typescript
import { createLogger } from "@hardlydifficult/logger";

const logger = createLogger("api", {
  level: "debug",
  console: false,
  file: "./logs/api.jsonl",
  alert: sendDiscordMessage,
  context: { region: "us-east-1" },
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `LogLevel` | `"info"` | Global minimum log level |
| `scope` | `string` | `undefined` | Added to every entry as `{ scope }` when using the object form |
| `context` | `Record<string, unknown>` | `undefined` | Extra context bound into every entry |
| `console` | `boolean` | `true` | Disable console logging by setting it to `false` |
| `file` | `string` | `undefined` | Mirror every entry to a JSONL file |
| `alert` | `(message: string) => void` | `undefined` | Send `warn`, `error`, and `alert()` messages to a sender |

### Logger methods

```typescript
logger.debug(message, context?);
logger.info(message, context?);
logger.warn(message, context?);
logger.error(message, context?);
logger.alert(message);
logger.child(context);
```

## Session Tracking

`SessionTracker` is the append-only JSONL tracker for AI sessions, agent runs, and other debug traces.

```typescript
import { SessionTracker } from "@hardlydifficult/logger";

const tracker = new SessionTracker({
  stateDirectory: "./state",
});

const session = tracker.session("chat/user-123");

session.request({ prompt: "Summarize this PR" });
session.error(new Error("model timeout"), { model: "gpt-5" });
```

### SessionTracker defaults

- Files live under `{stateDirectory}/sessions`.
- Old files are kept for 7 days by default.
- Session IDs are encoded before becoming filenames, so IDs like `"chat/user-123"` stay inside the tracker directory.
- Entry data uses the same safe serialization as the logger.

### SessionTracker methods

```typescript
tracker.session(sessionId);
tracker.append(sessionId, entry);
tracker.read(sessionId);
tracker.list();
tracker.has(sessionId);
tracker.delete(sessionId);
tracker.cleanup();
```

### Bound session methods

```typescript
session.start(data?);
session.request(data);
session.response(data);
session.toolCall(data);
session.toolResult(data);
session.metadata(data);
session.error(error, data?);
session.end(data?);
session.read();
session.exists();
session.delete();
```

## Low-Level API

If you need a custom destination, use `Logger` and implement `LoggerPlugin`. This is the escape hatch, not the default path.

```typescript
import { Logger, type LogEntry, type LoggerPlugin } from "@hardlydifficult/logger";

class SlackPlugin implements LoggerPlugin {
  log(entry: LogEntry): void {
    if (entry.level === "error") {
      // Send to Slack
    }
  }
}

const logger = new Logger("info").use(new SlackPlugin());
```

The package also exports `ConsolePlugin`, `FilePlugin`, `DiscordPlugin`, and `formatEntry()` for low-level composition.
