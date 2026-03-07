import { Logger } from "./Logger.js";
import { type DiscordSender, DiscordPlugin } from "./plugins/DiscordPlugin.js";
import { ConsolePlugin } from "./plugins/ConsolePlugin.js";
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

  if (!options.suppressConsole) {
    logger.use(new ConsolePlugin());
  }

  if (options.filePath) {
    logger.use(new FilePlugin(options.filePath));
  }

  if (options.discord) {
    const discord = new DiscordPlugin();
    discord.setSender(options.discord);
    logger.use(discord);
  }

  return options.name ? logger.withContext({ name: options.name }) : logger;
}
