/** Structured logging with pluggable outputs. */
export { Logger } from "./Logger.js";
export { ConsolePlugin, formatEntry } from "./plugins/ConsolePlugin.js";
export { DiscordPlugin, type DiscordSender } from "./plugins/DiscordPlugin.js";
export { FilePlugin } from "./plugins/FilePlugin.js";
export type { LogLevel, LogEntry, LoggerPlugin } from "./types.js";
