import type { LogEntry, LoggerPlugin } from "../types.js";

/** Formats a log entry into a human-readable string with timestamp, level, message, and optional context. */
export function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
  if (entry.context && Object.keys(entry.context).length > 0) {
    return `${base} ${JSON.stringify(entry.context)}`;
  }
  return base;
}

/** Logger plugin that writes formatted log entries to the console, routing to the appropriate console method by level. */
export class ConsolePlugin implements LoggerPlugin {
  log(entry: LogEntry): void {
    const formatted = formatEntry(entry);
    switch (entry.level) {
      case "debug":
      case "info":
        // eslint-disable-next-line no-console
        console.log(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
      default:
        console.warn(formatted);
        break;
    }
  }
}
