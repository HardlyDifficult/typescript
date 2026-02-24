# @hardlydifficult/logger

Plugin-based structured logger with configurable log levels and extensible output handlers for Console, File, Discord, and Session-based JSONL tracking.

## Installation

```bash
npm install @hardlydifficult/logger
```

## Quick Start

```typescript
import { Logger, ConsolePlugin, FilePlugin } from "@hardlydifficult/logger";

const logger = new Logger("info")
  .use(new ConsolePlugin())
  .use(new FilePlugin("./app.log"));

logger.info("Server started", { port: 3000 });
// Output to console: [2025-01-15T10:30:00.000Z] INFO: Server started {"port":3000}
// Output to file: {"level":"info","message":"Server started","timestamp":"2025-01-15T10:30:00.000Z","context":{"port":3000}}
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

### Notifications

Out-of-band notifications are sent to plugins that implement `notify()`.

```typescript
logger.notify("Deployment complete");
// DiscordPlugin will send this as a standalone message; other plugins ignore it.
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

const entry = {
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

Forwards `warn` and `error` log entries and notifications to Discord via a configurable sender function. Useful for alerting on critical issues.

### Setup

1. Create a Discord webhook for your channel.
2. Configure the sender to POST to the webhook URL.

```typescript
import { Logger, DiscordPlugin } from "@hardlydifficult/logger";

const logger = new Logger("warn");
const discord = new DiscordPlugin();

discord.setSender((message) => {
  // Example: use node:fetch or your preferred HTTP client
  // fetch("https://discord.com/api/webhooks/...", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ content: message })
  // });
});

logger.use(discord);
```

### Behavior

| Behavior | Description |
|--------|-------------|
| Only `warn` and `error` log entries are sent (debug/info are filtered) | |
| Warn entries use ⚠️ emoji; error entries use 🚨 emoji | |
| Context is formatted as a JSON code block when present | |
| `notify()` sends messages directly without level filtering | |
| If `setSender` is not called, entries are silently dropped | |

### Formatting

Error entries include a siren emoji and JSON context in a code block; warnings use a warning emoji.

```typescript
logger.error("Database unavailable", { host: "db.example.com", retry: 3 });
// ➡️ Sends to Discord:
// 🚨 **ERROR**: Database unavailable
// ```json
// {
//   "host": "db.example.com",
//   "retry": 3
// }
// ```

logger.warn("Slow query detected", { durationMs: 2500 });
// ➡️ Sends to Discord:
// ⚠️ **WARN**: Slow query detected
```

## Session Tracking

The `SessionTracker` class persists structured session logs as JSONL files for debugging and analysis.

### SessionTracker

Create a tracker pointing to a writable state directory.

```typescript
import { SessionTracker } from "@hardlydifficult/logger";

const tracker = new SessionTracker({
  stateDirectory: "/var/log", // Required
  subdirectory: "ai-sessions", // Optional, defaults to "sessions"
  maxAgeMs: 7 * 24 * 60 * 60 * 1000, // Optional, defaults to 7 days
});
```

### Append Entries

Each entry includes a type discriminator and arbitrary data.

```typescript
tracker.append("sess-abc123", {
  type: "session_start",
  data: { userId: 456, prompt: "Hello" },
});

tracker.append("sess-abc123", {
  type: "ai_response",
  data: { response: "Hi there!", model: "gpt-4" },
});

tracker.append("sess-abc123", {
  type: "tool_call",
  data: { name: "Search", input: { query: "weather" } },
});
```

### Read & List Sessions

```typescript
// Read all entries for a session
const entries = tracker.read("sess-abc123");
// Returns SessionEntry[] in chronological order

// List all tracked sessions with metadata
const sessions = tracker.list();
// Returns SessionInfo[] sorted by lastModifiedAt descending
```

### Session Metadata

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Name of the `.jsonl` file (without extension) |
| `sizeBytes` | number | File size on disk |
| `startedAt` | string | ISO timestamp (first entry or file creation time) |
| `lastModifiedAt` | string | ISO timestamp of file’s last write |
| `entryCount` | number | Number of JSONL lines in the file |

### Session Operations

```typescript
tracker.has("sess-abc123"); // true/false
tracker.delete("sess-abc123"); // true if deleted, false if missing
tracker.cleanup(); // Deletes files older than maxAgeMs, returns count deleted
```

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
import type {
  LogLevel,
  LogEntry,
  LoggerPlugin,
  SessionEntry,
  SessionEntryType,
  SessionInfo,
  SessionTrackerOptions,
} from "@hardlydifficult/logger";
```

| Type | Description |
|------|-------------|
| `LogLevel` | `"debug" \| "info" \| "warn" \| "error"` |
| `LogEntry` | `{ level, message, timestamp, context? }` |
| `LoggerPlugin` | `{ log(entry): void; notify?(message): void }` |
| `SessionEntryType` | `"session_start" \| "ai_request" \| "ai_response" \| "tool_call" \| "tool_result" \| "error" \| "session_end" \| "metadata"` |
| `SessionEntry` | `{ type, timestamp, data }` |
| `SessionInfo` | Metadata about persisted session files |
| `SessionTrackerOptions` | `stateDirectory` (required), `subdirectory?`, `maxAgeMs?` |

```typescript
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