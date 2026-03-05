import { CursorCloudRepo } from "./CursorCloudRepo.js";
import {
  AgentIdSchema,
  CancelAgentRequestSchema,
  CancelAgentResponseSchema,
  CursorAgentStatusSchema,
  DeleteAgentResponseSchema,
  FollowupRequestSchema,
  GetAgentLogsQuerySchema,
  GetAgentLogsResponseSchema,
  GetConversationResponseSchema,
  LaunchCursorAgentInputSchema,
  LaunchCursorAgentRequestSchema,
  LaunchCursorAgentResponseSchema,
  ListAgentsQuerySchema,
  ListAgentsResponseSchema,
  PromptSchema,
  UpdateAgentRequestSchema,
  UpdateAgentResponseSchema,
} from "./schemas.js";
import type {
  CancelAgentRequest,
  CancelAgentResponse,
  CursorAgentStatus,
  CursorCloudClientOptions,
  CursorRunResult,
  DeleteAgentResponse,
  GetAgentLogsQuery,
  GetAgentLogsResponse,
  GetConversationResponse,
  LaunchCursorAgentInput,
  LaunchCursorAgentRequest,
  LaunchCursorAgentResponse,
  ListAgentsQuery,
  ListAgentsResponse,
  UpdateAgentRequest,
  UpdateAgentResponse,
  WaitForAgentOptions,
} from "./types.js";
import {
  buildQueryString,
  normalizeBaseUrl,
  requireNonEmpty,
  sleep,
  validateAndParse,
} from "./utils.js";

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

  /** Launch a Cursor remote agent session. Delegates to createAgent(). */
  async launch(
    input: LaunchCursorAgentInput
  ): Promise<LaunchCursorAgentResponse> {
    return this.createAgent(input);
  }

  /** Get latest status for a Cursor remote agent session. Delegates to getAgent(). */
  async status(agentId: string): Promise<CursorAgentStatus> {
    return this.getAgent(agentId);
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
    const validatedQuery = validateAndParse(
      query,
      ListAgentsQuerySchema,
      "List agents query"
    );
    const { includeArchived = false, ...apiQuery } = validatedQuery;
    const queryString = buildQueryString(apiQuery);
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents${queryString}`,
      { method: "GET" }
    );
    const parsedResponse = validateAndParse(
      response,
      ListAgentsResponseSchema,
      "List agents response"
    );

    // Match browser defaults by hiding archived sessions unless explicitly requested.
    if (includeArchived || validatedQuery.status === "archived") {
      return parsedResponse;
    }

    const visibleAgents = parsedResponse.agents.filter(
      (agent) => agent.status !== "archived"
    );
    return {
      ...parsedResponse,
      agents: visibleAgents,
    };
  }

  /** Cancel a running agent. */
  async cancelAgent(
    agentId: string,
    request: CancelAgentRequest = {}
  ): Promise<CancelAgentResponse> {
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    const validatedRequest = validateAndParse(
      request,
      CancelAgentRequestSchema,
      "Cancel request"
    );
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}/cancel`,
      { method: "POST", body: JSON.stringify(validatedRequest) }
    );
    return validateAndParse(
      response,
      CancelAgentResponseSchema,
      "Cancel response"
    );
  }

  /** Update agent metadata or configuration. */
  async updateAgent(
    agentId: string,
    request: UpdateAgentRequest
  ): Promise<UpdateAgentResponse> {
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    const validatedRequest = validateAndParse(
      request,
      UpdateAgentRequestSchema,
      "Update request"
    );
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}`,
      { method: "PATCH", body: JSON.stringify(validatedRequest) }
    );
    return validateAndParse(
      response,
      UpdateAgentResponseSchema,
      "Update response"
    );
  }

  /** Get logs for an agent. */
  async getAgentLogs(
    agentId: string,
    query: GetAgentLogsQuery = {}
  ): Promise<GetAgentLogsResponse> {
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    const validatedQuery = validateAndParse(
      query,
      GetAgentLogsQuerySchema,
      "Logs query"
    );
    const queryString = buildQueryString(validatedQuery);
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}/logs${queryString}`,
      { method: "GET" }
    );
    return validateAndParse(
      response,
      GetAgentLogsResponseSchema,
      "Logs response"
    );
  }

  /** Delete an agent. */
  async deleteAgent(agentId: string): Promise<DeleteAgentResponse> {
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}`,
      { method: "DELETE" }
    );
    return validateAndParse(
      response,
      DeleteAgentResponseSchema,
      "Delete response"
    );
  }

  /** Create and launch a new agent session. Accepts prompt, repo, branch, model, and an optional webhook. */
  async createAgent(
    params: LaunchCursorAgentInput
  ): Promise<LaunchCursorAgentResponse> {
    const validated = validateAndParse(
      params,
      LaunchCursorAgentInputSchema,
      "Create agent params"
    );

    const request: LaunchCursorAgentRequest = {
      prompt: { text: validated.prompt },
      source: {
        repository: validated.repository,
        branch: validated.branch ?? DEFAULT_BRANCH,
      },
      ...(validated.model !== undefined && { model: validated.model }),
      ...(validated.webhook !== undefined && { webhook: validated.webhook }),
    };

    validateAndParse(request, LaunchCursorAgentRequestSchema, "Agent request");

    const response = await this.requestJson<Record<string, unknown>>(
      "/v0/agents",
      { method: "POST", body: JSON.stringify(request) }
    );
    return validateAndParse(
      response,
      LaunchCursorAgentResponseSchema,
      "Create agent response"
    );
  }

  /** Get status and metadata for an agent. */
  async getAgent(id: string): Promise<CursorAgentStatus> {
    const validatedId = validateAndParse(id, AgentIdSchema, "Agent ID");
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}`,
      { method: "GET" }
    );
    return validateAndParse(
      response,
      CursorAgentStatusSchema,
      "Get agent response"
    );
  }

  /** Retrieve the full conversation history for an agent. */
  async getConversation(agentId: string): Promise<GetConversationResponse> {
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(validatedId)}/conversation`,
      { method: "GET" }
    );
    return validateAndParse(
      response,
      GetConversationResponseSchema,
      "Get conversation response"
    );
  }

  /** Send a followup instruction to a running agent. */
  async followup(agentId: string, prompt: string): Promise<void> {
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    const validatedPrompt = validateAndParse(
      prompt,
      PromptSchema,
      "Followup prompt"
    );
    await this.requestJson<unknown>(
      `/v0/agents/${encodeURIComponent(validatedId)}/followup`,
      {
        method: "POST",
        body: JSON.stringify(
          validateAndParse(
            { prompt: validatedPrompt },
            FollowupRequestSchema,
            "Followup request"
          )
        ),
      }
    );
  }

  /** Stop a running agent. */
  async stop(agentId: string): Promise<void> {
    const validatedId = validateAndParse(agentId, AgentIdSchema, "Agent ID");
    await this.requestJson<unknown>(
      `/v0/agents/${encodeURIComponent(validatedId)}/stop`,
      { method: "POST", body: JSON.stringify({}) }
    );
  }

  /**
   * Interrupt a running agent and redirect it with a new instruction.
   * Stops the agent first, then sends the followup prompt.
   */
  async interrupt(agentId: string, prompt: string): Promise<void> {
    await this.stop(agentId);
    await this.followup(agentId, prompt);
  }

  private basicAuthHeader(): string {
    const encoded = Buffer.from(`${this.apiKey}:`).toString("base64");
    return `Basic ${encoded}`;
  }

  private async requestJson<T>(
    path: string,
    init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: string }
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: this.basicAuthHeader(),
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
