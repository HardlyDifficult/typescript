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
