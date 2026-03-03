import { type FetchLike, requestJsonWithRetry } from "./retry.js";
import type {
  CallStatusResponse,
  CallSubmitRequest,
  CallSubmitResponse,
  PollEvent,
  PollResult,
} from "./types.js";

const TERMINAL_STATUSES = new Set(["completed", "failed", "not-found"]);

export interface CallClientOptions {
  endpoint: string;
  apiToken: string;
  submitPath?: string;
  statusPathPrefix?: string;
  requestTimeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  maxRetryDelayMs?: number;
  fetchImpl?: FetchLike;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface PollCallOptions {
  source: string;
  timeoutMs: number;
  pollIntervalMs: number;
  onPoll?: (event: PollEvent) => void;
}

export interface SubmitAndPollOptions extends PollCallOptions {
  request: CallSubmitRequest;
}

/** Client for outbound call submission and status polling. */
export class CallClient {
  private readonly endpoint: string;
  private readonly apiToken: string;
  private readonly submitPath: string;
  private readonly statusPathPrefix: string;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly fetchImpl?: FetchLike;
  private readonly sleepFn?: (ms: number) => Promise<void>;

  constructor(options: CallClientOptions) {
    if (options.endpoint.trim() === "") {
      throw new Error("Endpoint is required");
    }
    if (options.apiToken.trim() === "") {
      throw new Error("API token is required");
    }

    this.endpoint = options.endpoint;
    this.apiToken = options.apiToken;
    this.submitPath = options.submitPath ?? "/call";
    this.statusPathPrefix = options.statusPathPrefix ?? "/call/status";
    this.requestTimeoutMs = options.requestTimeoutMs ?? 20_000;
    this.maxRetries = options.maxRetries ?? 6;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 10_000;
    this.fetchImpl = options.fetchImpl;
    this.sleepFn = options.sleepFn;
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiToken}`,
    };
  }

  private async sleep(ms: number): Promise<void> {
    if (this.sleepFn) {
      await this.sleepFn(ms);
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /** Submit a new outbound call request. */
  async submitCall(request: CallSubmitRequest): Promise<CallSubmitResponse> {
    if (request.firstMessage.trim() === "") {
      throw new Error("firstMessage is required");
    }
    if (request.systemPrompt.trim() === "") {
      throw new Error("systemPrompt is required");
    }
    if (request.source.trim() === "") {
      throw new Error("source is required");
    }

    return requestJsonWithRetry<CallSubmitResponse>({
      endpoints: [this.endpoint],
      path: this.submitPath,
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        first_message: request.firstMessage,
        system_prompt: request.systemPrompt,
        source: request.source,
      }),
      timeoutMs: this.requestTimeoutMs,
      maxRetries: this.maxRetries,
      baseDelayMs: this.retryBaseMs,
      maxDelayMs: this.maxRetryDelayMs,
      fetchImpl: this.fetchImpl,
      sleepFn: this.sleepFn,
    });
  }

  /** Fetch latest call status for a source ID. */
  async getStatus(source: string): Promise<CallStatusResponse> {
    if (source.trim() === "") {
      throw new Error("source is required");
    }

    return requestJsonWithRetry<CallStatusResponse>({
      endpoints: [this.endpoint],
      path: `${this.statusPathPrefix}/${encodeURIComponent(source)}`,
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiToken}` },
      timeoutMs: this.requestTimeoutMs,
      maxRetries: this.maxRetries,
      baseDelayMs: this.retryBaseMs,
      maxDelayMs: this.maxRetryDelayMs,
      fetchImpl: this.fetchImpl,
      sleepFn: this.sleepFn,
    });
  }

  /** Poll status until terminal state or timeout. */
  async pollStatus(options: PollCallOptions): Promise<PollResult> {
    const deadline = Date.now() + options.timeoutMs;
    let attempt = 0;
    let lastPayload: CallStatusResponse = { status: "unknown" };

    while (Date.now() <= deadline) {
      attempt += 1;
      const atMs = Date.now();
      try {
        const payload = await this.getStatus(options.source);
        lastPayload = payload;
        options.onPoll?.({ attempt, atMs, status: payload.status });

        if (TERMINAL_STATUSES.has(payload.status)) {
          return {
            status: payload.status as PollResult["status"],
            payload,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.onPoll?.({ attempt, atMs, status: "error", error: message });
      }

      if (Date.now() > deadline) {
        break;
      }
      await this.sleep(options.pollIntervalMs);
    }

    return { status: "timeout", payload: lastPayload };
  }

  /** Submit call and poll until terminal status or timeout. */
  async submitAndPoll(
    options: SubmitAndPollOptions
  ): Promise<{ submitResponse: CallSubmitResponse; pollResult: PollResult }> {
    const submitResponse = await this.submitCall(options.request);
    const pollResult = await this.pollStatus(options);
    return { submitResponse, pollResult };
  }
}
