import type { CursorAgentStatus } from "./schemas.js";

// Re-export types from schemas for convenience and backward compatibility
export type {
  CursorAgentStatus,
  Webhook,
  LaunchCursorAgentInput,
  LaunchCursorAgentRequest,
  LaunchCursorAgentResponse,
  CursorRunResult,
  ListAgentsQuery,
  ListAgentsResponse,
  CancelAgentRequest,
  CancelAgentResponse,
  UpdateAgentRequest,
  UpdateAgentResponse,
  AgentLogEntry,
  GetAgentLogsQuery,
  GetAgentLogsResponse,
  DeleteAgentResponse,
  ConversationMessage,
  GetConversationResponse,
  FollowupRequest,
  StopAgentResponse,
} from "./schemas.js";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

// Extended options with fetch and sleep functions (not in Zod schemas)
export interface CursorCloudClientOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface WaitForAgentOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  onPoll?: (status: CursorAgentStatus) => void;
}

export interface RunCursorAgentOptions extends WaitForAgentOptions {
  model?: string;
}
