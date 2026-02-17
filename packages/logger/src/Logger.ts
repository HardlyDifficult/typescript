import type { LogEntry, LoggerPlugin, LogLevel } from "./types.js";

const LOG_LEVELS: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface PluginEntry {
  readonly plugin: LoggerPlugin;
  readonly minLevel?: LogLevel;
}

/** Plugin-based structured logger that dispatches log entries to registered plugins based on a minimum log level. */
export class Logger {
  private readonly minLevel: LogLevel;
  private readonly plugins: PluginEntry[] = [];

  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
  }

  use(plugin: LoggerPlugin, options?: { minLevel?: LogLevel }): this {
    this.plugins.push({ plugin, minLevel: options?.minLevel });
    return this;
  }

  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("error", message, context);
  }

  notify(message: string): void {
    for (const { plugin } of this.plugins) {
      if (plugin.notify) {
        try {
          plugin.notify(message);
        } catch {
          /* swallow */
        }
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Readonly<Record<string, unknown>>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry =
      context !== undefined
        ? { level, message, timestamp: new Date().toISOString(), context }
        : { level, message, timestamp: new Date().toISOString() };

    for (const { plugin, minLevel } of this.plugins) {
      if (minLevel !== undefined && LOG_LEVELS[level] < LOG_LEVELS[minLevel]) {
        continue;
      }
      try {
        plugin.log(entry);
      } catch {
        /* swallow */
      }
    }
  }
}
