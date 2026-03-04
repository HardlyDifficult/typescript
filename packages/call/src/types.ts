export interface CallSubmitRequest {
  firstMessage: string;
  systemPrompt: string;
  source: string;
}

export interface CallSubmitResponse {
  queued?: boolean;
  position?: number;
  [key: string]: unknown;
}

export interface CallStatusResponse {
  status: string;
  conversationId?: string;
  transcript?: string;
  transcriptSummary?: string;
  callAttempts?: number;
  [key: string]: unknown;
}

export type TerminalCallStatus = "completed" | "failed" | "not-found";

export interface PollEvent {
  attempt: number;
  atMs: number;
  status: string;
  error?: string;
}

export interface PollResult {
  status: TerminalCallStatus | "timeout";
  payload: CallStatusResponse;
}

/**
 * Strategy for waiting on call status:
 * - "poll": repeated GET requests with a sleep interval between them (default)
 * - "long-poll": GET with a `?wait=N` query param; server holds the connection
 *   until status changes or the wait window expires, then client reconnects
 * - "sse": persistent Server-Sent Events stream; server pushes events as they occur
 */
export type WaitStrategy = "poll" | "long-poll" | "sse";

/** A parsed Server-Sent Events message. */
export interface SseMessage {
  id?: string;
  event?: string;
  data: string;
}
