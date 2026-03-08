import { normalizeContext } from "./serialize.js";
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
  private baseContext?: Readonly<Record<string, unknown>>;

  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
  }

  use(plugin: LoggerPlugin, options?: { minLevel?: LogLevel }): this {
    this.plugins.push({ plugin, minLevel: options?.minLevel });
    return this;
  }

  child(context: Readonly<Record<string, unknown>>): Logger {
    const child = new Logger(this.minLevel);
    child.plugins.push(...this.plugins);
    child.baseContext = mergeContexts(this.baseContext, context);
    return child;
  }

  withContext(context: Readonly<Record<string, unknown>>): Logger {
    return this.child(context);
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

  alert(message: string): void {
    for (const { plugin } of this.plugins) {
      const sendAlert = plugin.alert ?? plugin.notify;
      if (sendAlert) {
        try {
          sendAlert(message);
        } catch {
          /* swallow */
        }
      }
    }
  }

  notify(message: string): void {
    this.alert(message);
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

    const mergedContext = mergeContexts(this.baseContext, context);
    const entry: LogEntry =
      mergedContext !== undefined
        ? {
            level,
            message,
            timestamp: new Date().toISOString(),
            context: normalizeContext(mergedContext),
          }
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

function mergeContexts(
  baseContext?: Readonly<Record<string, unknown>>,
  context?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined {
  if (baseContext === undefined && context === undefined) {
    return undefined;
  }

  return {
    ...(baseContext ?? {}),
    ...(context ?? {}),
  };
}
