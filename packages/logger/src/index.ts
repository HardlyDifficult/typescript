/** Structured logging with pluggable outputs and session tracking. */
export { EventBus } from "./EventBus.js";
export type { EventBusEvent, EventBusOptions } from "./EventBus.js";
export { createLogger } from "./createLogger.js";
export { Logger } from "./Logger.js";
export { ConsolePlugin, formatEntry } from "./plugins/ConsolePlugin.js";
export { DiscordPlugin, type DiscordSender } from "./plugins/DiscordPlugin.js";
export { FilePlugin } from "./plugins/FilePlugin.js";
export { JsonlStore } from "./JsonlStore.js";
export { SessionTracker, TrackedSession } from "./SessionTracker.js";
export type { CreateLoggerOptions } from "./createLogger.js";
export type { JsonlStoreOptions } from "./JsonlStore.js";
export type { LogLevel, LogEntry, LoggerPlugin } from "./types.js";
export type { SessionEntry, SessionEntryType, SessionInfo } from "./types.js";
export type { SessionTrackerOptions } from "./SessionTracker.js";
