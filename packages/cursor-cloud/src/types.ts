export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export interface CursorCloudClientOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface LaunchCursorAgentInput {
  prompt: string;
  repository: string;
  branch?: string;
  model?: string;
}

export interface LaunchCursorAgentRequest {
  prompt: {
    text: string;
  };
  source: {
    repository: string;
    branch: string;
  };
  model?: string;
}

export interface LaunchCursorAgentResponse {
  id: string;
  status?: string;
  [key: string]: unknown;
}

export interface CursorAgentStatus {
  id: string;
  status: string;
  model?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  gitBranch?: string;
  branchUrl?: string;
  repoName?: string;
  pullRequestUrl?: string;
  [key: string]: unknown;
}

export interface WaitForAgentOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  onPoll?: (status: CursorAgentStatus) => void;
}

export interface RunCursorAgentOptions extends WaitForAgentOptions {
  model?: string;
}

export interface CursorRunResult {
  agentId: string;
  launch: LaunchCursorAgentResponse;
  final: CursorAgentStatus;
}
