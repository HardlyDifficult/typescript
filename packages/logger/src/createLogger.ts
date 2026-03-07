import { Logger } from "./Logger.js";
import { ConsolePlugin } from "./plugins/ConsolePlugin.js";
import { DiscordPlugin, type DiscordSender } from "./plugins/DiscordPlugin.js";
import { FilePlugin } from "./plugins/FilePlugin.js";
import type { LogLevel } from "./types.js";

export interface CreateLoggerOptions {
  /** Included in every log entry to identify the source component. */
  name?: string;
  /** Minimum level written by the logger. Defaults to info. */
  level?: LogLevel;
  /** Disable the default console logger. */
  suppressConsole?: boolean;
  /** Optional JSONL file that receives every entry. */
  filePath?: string;
  /** Optional Discord sender for warn/error entries and notify() messages. */
  discord?: DiscordSender;
}

/**
 * Opinionated logger factory with strong defaults:
 * always logs to console, optionally mirrors to a file, and can forward alerts
 * to Discord. Use Logger directly only when you need custom plugins.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const logger = new Logger(options.level ?? "info");

  if (options.suppressConsole !== true) {
    logger.use(new ConsolePlugin());
  }

  if (typeof options.filePath === "string" && options.filePath.length > 0) {
    logger.use(new FilePlugin(options.filePath));
  }

  if (options.discord !== undefined) {
    const discord = new DiscordPlugin();
    discord.setSender(options.discord);
    logger.use(discord);
  }

  if (typeof options.name === "string" && options.name.length > 0) {
    return logger.withContext({ name: options.name });
  }

  return logger;
}
