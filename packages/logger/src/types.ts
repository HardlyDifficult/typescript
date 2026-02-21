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

// =============================================================================
// Session Tracking Types
// =============================================================================

/** Entry type discriminator for session log entries. */
export type SessionEntryType =
  | "session_start"
  | "ai_request"
  | "ai_response"
  | "tool_call"
  | "tool_result"
  | "error"
  | "session_end"
  | "metadata";

/** A single entry in a debug session log (persisted as one JSONL line). */
export interface SessionEntry {
  readonly type: SessionEntryType;
  readonly timestamp: string;
  readonly data: Record<string, unknown>;
}

/** Summary info about a persisted session file. */
export interface SessionInfo {
  readonly sessionId: string;
  readonly sizeBytes: number;
  readonly startedAt: string;
  readonly lastModifiedAt: string;
  readonly entryCount: number;
}
