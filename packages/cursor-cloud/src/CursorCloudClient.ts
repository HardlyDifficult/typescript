import { z } from "zod";

import type {
  CursorAgentStatus,
  CursorCloudClientOptions,
  CursorRunResult,
  LaunchCursorAgentInput,
  LaunchCursorAgentRequest,
  LaunchCursorAgentResponse,
  RunCursorAgentOptions,
  WaitForAgentOptions,
  ListAgentsQuery,
  ListAgentsResponse,
  CancelAgentRequest,
  CancelAgentResponse,
  UpdateAgentRequest,
  UpdateAgentResponse,
  GetAgentLogsQuery,
  GetAgentLogsResponse,
  DeleteAgentResponse,
} from "./types.js";
import {
  LaunchCursorAgentInputSchema,
  LaunchCursorAgentRequestSchema,
  LaunchCursorAgentResponseSchema,
  CursorAgentStatusSchema,
  ListAgentsQuerySchema,
  ListAgentsResponseSchema,
  CancelAgentRequestSchema,
  CancelAgentResponseSchema,
  UpdateAgentRequestSchema,
  UpdateAgentResponseSchema,
  GetAgentLogsQuerySchema,
  GetAgentLogsResponseSchema,
  DeleteAgentResponseSchema,
  AgentIdSchema,
} from "./schemas.js";

const DEFAULT_BASE_URL = "https://api.cursor.com";
const DEFAULT_BRANCH = "main";
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "canceled",
  "cancelled",
]);

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error(`${field} is required`);
  }
  return trimmed;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

/** Validate and parse data using a Zod schema. */
function validateAndParse<T>(data: unknown, schema: z.ZodType<T>, context: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
      throw new Error(`${context} validation failed: ${issues}`, { cause: error });
    }
    throw new Error(`${context} validation failed: ${String(error)}`, { cause: error });
  }
}

/** Build query string from object. */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      searchParams.append(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Focused client for Cursor Cloud remote agents.
 * Opinionated defaults:
 * - Base URL: https://api.cursor.com
 * - Poll interval: 5s
 * - Timeout: 20m
 * - Branch: main
 */
export class CursorCloudClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string | undefined;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(options: CursorCloudClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.CURSOR_API_KEY;
    if (apiKey === undefined || apiKey.trim() === "") {
      throw new Error(
        "Cursor API key is required. Set CURSOR_API_KEY or pass { apiKey }."
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.defaultModel = options.defaultModel;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepFn = options.sleepFn ?? sleep;
  }

  /** Start a chain for one repository. */
  repo(repository: string): CursorCloudRepo {
    return new CursorCloudRepo(this, {
      repository: requireNonEmpty(repository, "repository"),
      branch: DEFAULT_BRANCH,
      model: this.defaultModel,
    });
  }

  /** Launch a Cursor remote agent session. */
  async launch(
    input: LaunchCursorAgentInput
  ): Promise<LaunchCursorAgentResponse> {
    // Validate input
    const validatedInput = validateAndParse(input, LaunchCursorAgentInputSchema, "Launch input");

    const request: LaunchCursorAgentRequest = {
      prompt: { text: validatedInput.prompt },
      source: {
        repository: validatedInput.repository,
        branch: validatedInput.branch ?? DEFAULT_BRANCH,
      },
      ...(validatedInput.model !== undefined && {
        model: validatedInput.model,
      }),
    };

    // Validate request before sending
    validateAndParse(request, LaunchCursorAgentRequestSchema, "Launch request");

    const response = await this.requestJson<Record<string, unknown>>(
      "/v0/agents",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );

    // Validate and return response
    return validateAndParse(response, LaunchCursorAgentResponseSchema, "Launch response");
  }

  /** Get latest status for a Cursor remote agent session. */
  async status(agentId: string): Promise<CursorAgentStatus> {
    // Validate agent ID
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}`,
      { method: "GET" }
    );

    // Validate and return response
    return validateAndParse(response, CursorAgentStatusSchema, "Status response");
  }

  /** Poll until terminal status or timeout. */
  async wait(
    agentId: string,
    options: WaitForAgentOptions = {}
  ): Promise<CursorAgentStatus> {
    const id = requireNonEmpty(agentId, "agentId");
    const pollIntervalMs = options.pollIntervalMs ?? this.pollIntervalMs;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const status = await this.status(id);
      options.onPoll?.(status);

      if (TERMINAL_STATUSES.has(status.status.toLowerCase())) {
        return status;
      }

      if (Date.now() >= deadline) {
        return { ...status, id, status: "timeout" };
      }

      await this.sleepFn(pollIntervalMs);
    }
  }

  /** Convenience: launch a prompt and wait for completion. */
  async run(input: LaunchCursorAgentInput): Promise<CursorRunResult> {
    const launch = await this.launch(input);
    const final = await this.wait(launch.id);
    return { agentId: launch.id, launch, final };
  }

  /** List agents with optional filtering. */
  async listAgents(query: ListAgentsQuery = {}): Promise<ListAgentsResponse> {
    // Validate query parameters
    const validatedQuery = validateAndParse(query, ListAgentsQuerySchema, "List agents query");
    
    const queryString = buildQueryString(validatedQuery);
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents${queryString}`,
      { method: "GET" }
    );

    // Validate and return response
    return validateAndParse(response, ListAgentsResponseSchema, "List agents response");
  }

  /** Cancel a running agent. */
  async cancelAgent(agentId: string, request: CancelAgentRequest = {}): Promise<CancelAgentResponse> {
    // Validate inputs
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    const validatedRequest = validateAndParse(request, CancelAgentRequestSchema, "Cancel request");

    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(validatedRequest),
      }
    );

    // Validate and return response
    return validateAndParse(response, CancelAgentResponseSchema, "Cancel response");
  }

  /** Update agent metadata or configuration. */
  async updateAgent(agentId: string, request: UpdateAgentRequest): Promise<UpdateAgentResponse> {
    // Validate inputs
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    const validatedRequest = validateAndParse(request, UpdateAgentRequestSchema, "Update request");

    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(validatedRequest),
      }
    );

    // Validate and return response
    return validateAndParse(response, UpdateAgentResponseSchema, "Update response");
  }

  /** Get logs for an agent. */
  async getAgentLogs(agentId: string, query: GetAgentLogsQuery = {}): Promise<GetAgentLogsResponse> {
    // Validate inputs
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    const validatedQuery = validateAndParse(query, GetAgentLogsQuerySchema, "Logs query");
    
    const queryString = buildQueryString(validatedQuery);
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}/logs${queryString}`,
      { method: "GET" }
    );

    // Validate and return response
    return validateAndParse(response, GetAgentLogsResponseSchema, "Logs response");
  }

  /** Delete an agent. */
  async deleteAgent(agentId: string): Promise<DeleteAgentResponse> {
    // Validate agent ID
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}`,
      { method: "DELETE" }
    );

    // Validate and return response
    return validateAndParse(response, DeleteAgentResponseSchema, "Delete response");
  }

  private async requestJson<T>(
    path: string,
    init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: string }
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      ...(init.body !== undefined && { body: init.body }),
    });

    const raw = await response.text();
    let payload: unknown = {};

    if (raw.trim() !== "") {
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        if (!response.ok) {
          throw new Error(
            `Cursor API request failed (${String(response.status)} ${response.statusText}): ${raw}`
          );
        }
        throw new Error("Cursor API returned non-JSON response");
      }
    }

    if (!response.ok) {
      throw new Error(
        `Cursor API request failed (${String(response.status)} ${response.statusText}): ${JSON.stringify(payload)}`
      );
    }

    return payload as T;
  }
}

interface RepoChainState {
  repository: string;
  branch: string;
  model: string | undefined;
}

/** Chainable repo-scoped Cursor Cloud helper. */
export class CursorCloudRepo {
  constructor(
    private readonly client: CursorCloudClient,
    private readonly state: RepoChainState
  ) {}

  branch(name: string): CursorCloudRepo {
    return new CursorCloudRepo(this.client, {
      ...this.state,
      branch: requireNonEmpty(name, "branch"),
    });
  }

  model(name: string): CursorCloudRepo {
    return new CursorCloudRepo(this.client, {
      ...this.state,
      model: requireNonEmpty(name, "model"),
    });
  }

  async launch(prompt: string, options: RunCursorAgentOptions = {}) {
    return this.client.launch({
      prompt,
      repository: this.state.repository,
      branch: this.state.branch,
      model: options.model ?? this.state.model,
    });
  }

  wait(agentId: string, options: WaitForAgentOptions = {}) {
    return this.client.wait(agentId, options);
  }

  async run(
    prompt: string,
    options: RunCursorAgentOptions = {}
  ): Promise<CursorRunResult> {
    const launch = await this.launch(prompt, options);
    const final = await this.wait(launch.id, options);
    return { agentId: launch.id, launch, final };
  }

  /** List agents for this repository. */
  async list(query: Omit<ListAgentsQuery, "repository"> = {}): Promise<ListAgentsResponse> {
    return this.client.listAgents({
      ...query,
      repository: this.state.repository,
    });
  }

  /** Cancel an agent. */
  async cancel(agentId: string, request: CancelAgentRequest = {}): Promise<CancelAgentResponse> {
    return this.client.cancelAgent(agentId, request);
  }

  /** Update an agent. */
  async update(agentId: string, request: UpdateAgentRequest): Promise<UpdateAgentResponse> {
    return this.client.updateAgent(agentId, request);
  }

  /** Get agent logs. */
  async logs(agentId: string, query: GetAgentLogsQuery = {}): Promise<GetAgentLogsResponse> {
    return this.client.getAgentLogs(agentId, query);
  }

  /** Delete an agent. */
  async delete(agentId: string): Promise<DeleteAgentResponse> {
    return this.client.deleteAgent(agentId);
  }
}
