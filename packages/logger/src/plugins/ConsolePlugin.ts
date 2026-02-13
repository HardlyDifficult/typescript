import type { LogEntry, LoggerPlugin } from "../types.js";

export function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
  if (entry.context && Object.keys(entry.context).length > 0) {
    return `${base} ${JSON.stringify(entry.context)}`;
  }
  return base;
}

export class ConsolePlugin implements LoggerPlugin {
  log(entry: LogEntry): void {
    const formatted = formatEntry(entry);
    switch (entry.level) {
      case "debug":
      case "info":
        console.log(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }
}
