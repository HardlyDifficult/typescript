import type { CursorAgentStatus, Webhook } from "./schemas.js";

// Re-export schema-derived types for convenience.
export type {
  CursorAgentStatus,
  Webhook,
  LaunchCursorAgentInput,
  LaunchCursorAgentRequest,
  LaunchCursorAgentResponse,
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
  GetMeResponse,
  ListModelsResponse,
  RepositoryInfo,
  ListRepositoriesResponse,
  Artifact,
  ListArtifactsResponse,
  DownloadArtifactQuery,
  DownloadArtifactResponse,
} from "./schemas.js";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

// Extended options with fetch and sleep functions (not in Zod schemas)
export interface CursorCloudClientOptions {
  apiKey?: string;
  baseUrl?: string;
  webhook?: Webhook;
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
