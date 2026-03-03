import type {
  CursorAgentStatus,
  CursorCloudClientOptions,
  CursorRunResult,
  LaunchCursorAgentInput,
  LaunchCursorAgentRequest,
  LaunchCursorAgentResponse,
  RunCursorAgentOptions,
  WaitForAgentOptions,
} from "./types.js";

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
    const request: LaunchCursorAgentRequest = {
      prompt: { text: requireNonEmpty(input.prompt, "prompt") },
      source: {
        repository: requireNonEmpty(input.repository, "repository"),
        branch: requireNonEmpty(input.branch ?? DEFAULT_BRANCH, "branch"),
      },
      ...(input.model !== undefined && {
        model: requireNonEmpty(input.model, "model"),
      }),
    };

    const response = await this.requestJson<Record<string, unknown>>(
      "/v0/agents",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );

    const idCandidate = response.id ?? response.agentId;
    if (typeof idCandidate !== "string" || idCandidate.trim() === "") {
      throw new Error("Cursor launch response did not include an agent id");
    }

    return {
      ...response,
      id: idCandidate,
    };
  }

  /** Get latest status for a Cursor remote agent session. */
  async status(agentId: string): Promise<CursorAgentStatus> {
    const id = requireNonEmpty(agentId, "agentId");
    const response = await this.requestJson<Record<string, unknown>>(
      `/v0/agents/${encodeURIComponent(id)}`,
      { method: "GET" }
    );

    const statusValue =
      typeof response.status === "string" && response.status.trim() !== ""
        ? response.status
        : "unknown";

    return {
      ...response,
      id,
      status: statusValue,
    };
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

  private async requestJson<T>(
    path: string,
    init: { method: "GET" | "POST"; body?: string }
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
}
