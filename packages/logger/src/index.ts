/** Structured logging with pluggable outputs and session tracking. */
export { createLogger } from "./createLogger.js";
export { Logger } from "./Logger.js";
export { ConsolePlugin, formatEntry } from "./plugins/ConsolePlugin.js";
export { DiscordPlugin, type DiscordSender } from "./plugins/DiscordPlugin.js";
export { FilePlugin } from "./plugins/FilePlugin.js";
export { SessionTracker, TrackedSession } from "./SessionTracker.js";
export type { CreateLoggerOptions } from "./createLogger.js";
export type { LogLevel, LogEntry, LoggerPlugin } from "./types.js";
export type { SessionEntry, SessionEntryType, SessionInfo } from "./types.js";
export type { SessionTrackerOptions } from "./SessionTracker.js";
