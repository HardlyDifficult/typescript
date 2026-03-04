// Re-export types from schemas for convenience and backward compatibility
export type {
  LaunchCursorAgentInput,
  LaunchCursorAgentRequest,
  LaunchCursorAgentResponse,
  CursorAgentStatus,
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
  onPoll?: (status: import("./schemas.js").CursorAgentStatus) => void;
}

export interface RunCursorAgentOptions extends WaitForAgentOptions {
  model?: string;
}
