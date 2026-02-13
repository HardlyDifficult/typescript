export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface LoggerPlugin {
  /** Called for each log entry that passes the level filter. */
  log(entry: LogEntry): void;
  /** Called for notify() — out-of-band notifications. Optional. */
  notify?(message: string): void;
}
