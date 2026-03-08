import { Logger } from "./Logger.js";
import { ConsolePlugin } from "./plugins/ConsolePlugin.js";
import { DiscordPlugin, type DiscordSender } from "./plugins/DiscordPlugin.js";
import { FilePlugin } from "./plugins/FilePlugin.js";
import type { LogLevel } from "./types.js";

export interface CreateLoggerOptions {
  /** Minimum level written by the logger. Defaults to info. */
  level?: LogLevel;
  /** Included in every log entry as `{ scope }`. */
  scope?: string;
  /** Additional context bound into every entry. */
  context?: Readonly<Record<string, unknown>>;
  /** Keep console logging enabled unless explicitly set to false. */
  console?: boolean;
  /** Optional JSONL file that receives every entry. */
  file?: string;
  /** Optional sender for warn/error entries and alert() messages. */
  alert?: DiscordSender;
  /** Backwards-compatible alias for scope. */
  name?: string;
  /** Backwards-compatible alias for console: false. */
  suppressConsole?: boolean;
  /** Backwards-compatible alias for file. */
  filePath?: string;
  /** Backwards-compatible alias for alert. */
  discord?: DiscordSender;
}

type CreateLoggerOverrides = Omit<CreateLoggerOptions, "scope">;

interface NormalizedCreateLoggerOptions {
  readonly level: LogLevel;
  readonly console: boolean;
  readonly file?: string;
  readonly alert?: DiscordSender;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Opinionated logger factory with strong defaults:
 * always logs to console, optionally mirrors to a file, and can forward alerts
 * to Discord. Use Logger directly only when you need custom plugins.
 */
export function createLogger(
  scopeOrOptions?: string | CreateLoggerOptions,
  overrides?: CreateLoggerOverrides
): Logger {
  const options = normalizeCreateLoggerOptions(scopeOrOptions, overrides);
  const logger = new Logger(options.level);

  if (options.console) {
    logger.use(new ConsolePlugin());
  }

  if (typeof options.file === "string" && options.file.length > 0) {
    logger.use(new FilePlugin(options.file));
  }

  if (options.alert !== undefined) {
    const discord = new DiscordPlugin();
    discord.setSender(options.alert);
    logger.use(discord);
  }

  if (options.context !== undefined) {
    return logger.child(options.context);
  }

  return logger;
}

function normalizeCreateLoggerOptions(
  scopeOrOptions: string | CreateLoggerOptions | undefined,
  overrides: CreateLoggerOverrides | undefined
): NormalizedCreateLoggerOptions {
  const inlineOptions: CreateLoggerOverrides =
    typeof scopeOrOptions === "string"
      ? (overrides ?? {})
      : (scopeOrOptions ?? {});
  const scope =
    typeof scopeOrOptions === "string"
      ? scopeOrOptions
      : (scopeOrOptions?.scope ?? scopeOrOptions?.name);
  const context = mergeContexts(
    inlineOptions.context,
    typeof scope === "string" && scope.length > 0 ? { scope } : undefined
  );

  return {
    level: inlineOptions.level ?? "info",
    console: inlineOptions.console ?? inlineOptions.suppressConsole !== true,
    file: inlineOptions.file ?? inlineOptions.filePath,
    alert: inlineOptions.alert ?? inlineOptions.discord,
    context,
  };
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
