# @hardlydifficult/logger

Plugin-based structured logger with configurable log levels and extensible output handlers for Console, File, and Discord.

## Installation

```bash
npm install @hardlydifficult/logger
```

## Quick Start

```typescript
import { Logger, ConsolePlugin, FilePlugin, DiscordPlugin } from "@hardlydifficult/logger";

const logger = new Logger("info")
  .use(new ConsolePlugin())
  .use(new FilePlugin("./app.log"));

logger.info("Server started", { port: 3000 });
logger.warn("High memory usage", { usage: "85%" });
logger.error("Request failed", { url: "/api/data", status: 500 });
```

## Core Logger

The `Logger` class dispatches log entries to registered plugins based on a minimum log level.

```typescript
import { Logger } from "@hardlydifficult/logger";

const logger = new Logger("info"); // default: "info"
```

### Log Levels

Log levels in order of severity: `debug` < `info` < `warn` < `error`. Entries below the logger's `minLevel` are filtered out before reaching plugins.

### Methods

| Method | Description |
|--------|-------------|
| `use(plugin, options?)` | Register a plugin; returns `this` for chaining. Optional `minLevel` filters entries per-plugin. |
| `debug(message, context?)` | Log at debug level |
| `info(message, context?)` | Log at info level |
| `warn(message, context?)` | Log at warn level |
| `error(message, context?)` | Log at error level |
| `notify(message)` | Send out-of-band notification to plugins that support it |

### Plugin-Level Filtering

Each plugin can have its own minimum log level, independent of the logger's global level:

```typescript
const logger = new Logger("debug")
  .use(new ConsolePlugin()) // receives all levels
  .use(new FilePlugin("./errors.log"), { minLevel: "error" }); // only errors

logger.debug("This goes to console only");
logger.error("This goes to both console and file");
```

## Console Plugin

Outputs formatted log entries to the console, routing to `console.log`, `console.warn`, or `console.error` based on log level.

```typescript
import { Logger, ConsolePlugin } from "@hardlydifficult/logger";

const logger = new Logger("info").use(new ConsolePlugin());

logger.info("Server started", { port: 3000 });
// Output: [2025-01-15T10:30:00.000Z] INFO: Server started {"port":3000}
```

### Format

The `formatEntry` function is also exported for custom formatting:

```typescript
import { formatEntry } from "@hardlydifficult/logger";
import type { LogEntry } from "@hardlydifficult/logger";

const entry: LogEntry = {
  level: "warn",
  message: "High memory",
  timestamp: "2025-01-15T10:30:00.000Z",
  context: { usage: "85%" },
};

console.log(formatEntry(entry));
// Output: [2025-01-15T10:30:00.000Z] WARN: High memory {"usage":"85%"}
```

## File Plugin

Appends JSON-serialized log entries to a file (one entry per line, JSONL format). Creates parent directories automatically.

```typescript
import { Logger, FilePlugin } from "@hardlydifficult/logger";

const logger = new Logger("info").use(new FilePlugin("./logs/app.log"));

logger.info("Request processed", { method: "GET", path: "/api/users" });
// Appends: {"level":"info","message":"Request processed","timestamp":"2025-01-15T10:30:00.000Z","context":{"method":"GET","path":"/api/users"}}
```

## Discord Plugin

Forwards warn/error log entries and notifications to Discord via a configurable sender function. Useful for alerting on critical issues.

```typescript
import { Logger, DiscordPlugin } from "@hardlydifficult/logger";

const discord = new DiscordPlugin();
const logger = new Logger("info").use(discord);

// Set the sender once your Discord bot is ready
discord.setSender((msg) => channel.send(msg));

logger.warn("High memory usage", { usage: "85%" });
// Sends to Discord: ⚠️ **WARN**: High memory usage
// ```json
// {
//   "usage": "85%"
// }
// ```

logger.notify("Deployment complete");
// Sends to Discord: Deployment complete
```

### Behavior

- Only `warn` and `error` log entries are sent (debug/info are filtered)
- Warn entries use ⚠️ emoji; error entries use 🚨 emoji
- Context is formatted as a JSON code block when present
- `notify()` sends messages directly without level filtering
- If `setSender` is not called, entries are silently dropped

## Custom Plugins

Implement the `LoggerPlugin` interface to create custom output handlers:

```typescript
import type { LoggerPlugin, LogEntry } from "@hardlydifficult/logger";
import { Logger } from "@hardlydifficult/logger";

class SlackPlugin implements LoggerPlugin {
  log(entry: LogEntry): void {
    if (entry.level === "error") {
      // Send to Slack
    }
  }

  notify?(message: string): void {
    // Send notification to Slack
  }
}

const logger = new Logger("info").use(new SlackPlugin());
```

## Types

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string; // ISO 8601 format
  readonly context?: Readonly<Record<string, unknown>>;
}

interface LoggerPlugin {
  log(entry: LogEntry): void;
  notify?(message: string): void;
}

type DiscordSender = (message: string) => void;
```

## Error Handling

All plugins are isolated—if one plugin throws an error, it does not affect other plugins or the logger itself. Errors are silently swallowed to ensure logging never crashes your application.

```typescript
const logger = new Logger("info")
  .use(new ConsolePlugin()) // works fine
  .use(brokenPlugin); // throws, but doesn't break the logger

logger.info("This still works"); // ConsolePlugin receives it
```