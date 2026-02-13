# @hardlydifficult/logger

Plugin-based structured logger with Console, Discord, and File output plugins.

## Installation

```bash
npm install @hardlydifficult/logger
```

## Usage

```typescript
import { Logger, ConsolePlugin, FilePlugin, DiscordPlugin } from "@hardlydifficult/logger";

const discord = new DiscordPlugin();

const logger = new Logger("info")
  .use(new ConsolePlugin())
  .use(new FilePlugin("/var/log/app.log"))
  .use(discord);

// Wire up Discord sender once the bot is ready
discord.setSender((msg) => channel.send(msg));

logger.info("Server started", { port: 3000 });
logger.warn("High memory usage", { usage: "85%" });
logger.error("Request failed", { url: "/api/data", status: 500 });

// Out-of-band notification (goes to plugins that support notify)
logger.notify("Deployment complete");
```

## API

### `Logger`

```typescript
new Logger(minLevel?: LogLevel) // default: "info"
```

| Method | Description |
|--------|-------------|
| `use(plugin)` | Register a plugin (returns `this` for chaining) |
| `debug(message, context?)` | Log at debug level |
| `info(message, context?)` | Log at info level |
| `warn(message, context?)` | Log at warn level |
| `error(message, context?)` | Log at error level |
| `notify(message)` | Send out-of-band notification to plugins that support it |

Log levels: `debug` < `info` < `warn` < `error`. Entries below `minLevel` are filtered out.

### Plugins

#### `ConsolePlugin`

Logs to `console.log`/`console.warn`/`console.error` with formatted timestamps.

```typescript
new ConsolePlugin()
```

#### `FilePlugin`

Appends JSON log entries to a file (one entry per line). Creates the directory if needed.

```typescript
new FilePlugin(filePath: string)
```

#### `DiscordPlugin`

Sends warn/error logs and notifications to Discord. The sender is set lazily since the Discord connection may not be ready at logger creation time.

```typescript
const discord = new DiscordPlugin();
discord.setSender((msg) => channel.send(msg));
```

### Custom Plugins

Implement the `LoggerPlugin` interface:

```typescript
import type { LoggerPlugin, LogEntry } from "@hardlydifficult/logger";

class MyPlugin implements LoggerPlugin {
  log(entry: LogEntry): void {
    // Handle log entry
  }

  // Optional: handle notify() calls
  notify?(message: string): void {
    // Handle notification
  }
}

logger.use(new MyPlugin());
```

### Types

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

interface LoggerPlugin {
  log(entry: LogEntry): void;
  notify?(message: string): void;
}
```
