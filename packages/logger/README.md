# @hardlydifficult/logger

Opinionated structured logging with strong defaults.

Use `createLogger()` for application logs. It writes to console by default, can mirror to a JSONL file, can forward alerts to Discord, and lets you bind business context once with `withContext()`. The low-level plugin API still exists, but it is not the preferred client path.

## Installation

```bash
npm install @hardlydifficult/logger
```

## Preferred API

```typescript
import { createLogger } from "@hardlydifficult/logger";

const logger = createLogger({
  name: "payments",
  filePath: "./logs/app.jsonl",
  discord: (message) => {
    // POST to your Discord webhook here
  },
});

logger.info("service started", { port: 3000 });
```

### Strong defaults

- Console logging is on by default.
- Default level is `info`.
- Discord only receives `warn`, `error`, and `notify()` messages.
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
const orderLogger = logger.withContext({
  orderId: "ord_123",
  customerId: "cus_456",
});

orderLogger.info("charge requested", { amountCents: 4999 });
orderLogger.info("receipt sent");
```

Per-call context is merged with bound context. If keys overlap, the per-call value wins.

## Notifications

Use `notify()` for out-of-band alerts that should bypass normal log levels.

```typescript
logger.notify("manual intervention required");
```

When `discord` is configured, `notify()` sends the message directly to Discord.

## API

### `createLogger(options?)`

```typescript
import { createLogger } from "@hardlydifficult/logger";

const logger = createLogger({
  name: "api",
  level: "debug",
  suppressConsole: true,
  filePath: "./logs/api.jsonl",
  discord: sendDiscordMessage,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `undefined` | Added to every entry as context |
| `level` | `LogLevel` | `"info"` | Global minimum log level |
| `suppressConsole` | `boolean` | `false` | Disable the default console logger |
| `filePath` | `string` | `undefined` | Mirror every entry to a JSONL file |
| `discord` | `(message: string) => void` | `undefined` | Send `warn`, `error`, and `notify()` messages to Discord |

### Logger methods

```typescript
logger.debug(message, context?);
logger.info(message, context?);
logger.warn(message, context?);
logger.error(message, context?);
logger.notify(message);
logger.withContext(context);
```

## Session Tracking

`SessionTracker` is the package's append-only JSONL tracker for AI sessions, agent runs, and other debug traces.

```typescript
import { SessionTracker } from "@hardlydifficult/logger";

const tracker = new SessionTracker({
  stateDirectory: "./state",
});

tracker.append("chat/user-123", {
  type: "ai_request",
  data: { prompt: "Summarize this PR" },
});

tracker.append("chat/user-123", {
  type: "error",
  data: { error: new Error("model timeout") },
});
```

### SessionTracker defaults

- Files live under `{stateDirectory}/sessions`.
- Old files are kept for 7 days by default.
- Session IDs are encoded before becoming filenames, so IDs like `"chat/user-123"` stay inside the tracker directory.
- Entry data uses the same safe serialization as the logger.

### SessionTracker methods

```typescript
tracker.append(sessionId, entry);
tracker.read(sessionId);
tracker.list();
tracker.has(sessionId);
tracker.delete(sessionId);
tracker.cleanup();
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
