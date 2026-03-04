import {
  HttpRequestError,
  type FetchLike,
  joinUrl,
  requestJsonWithRetry,
} from "./retry.js";
import type {
  CallStatusResponse,
  CallSubmitRequest,
  CallSubmitResponse,
  PollEvent,
  PollResult,
  SseMessage,
  WaitStrategy,
} from "./types.js";

const TERMINAL_STATUSES = new Set(["completed", "failed", "not-found"]);

export interface CallClientOptions {
  endpoint: string;
  apiToken: string;
  submitPath?: string;
  statusPathPrefix?: string;
  /** Path prefix for SSE event stream (default: "/call/events"). */
  ssePathPrefix?: string;
  requestTimeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  maxRetryDelayMs?: number;
  /**
   * How long (in seconds) the server should hold a long-poll connection open
   * before returning an empty response. The actual HTTP request timeout is
   * automatically extended to accommodate this. (default: 30)
   */
  longPollWaitSecs?: number;
  fetchImpl?: FetchLike;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface PollCallOptions {
  source: string;
  timeoutMs: number;
  /** Only used for the "poll" strategy. */
  pollIntervalMs: number;
  /**
   * How to wait for status updates:
   * - "poll" (default): repeated GET requests with sleep between them
   * - "long-poll": GET with `?wait=N`; server holds connection until change
   * - "sse": persistent SSE stream; server pushes events
   */
  strategy?: WaitStrategy;
  onPoll?: (event: PollEvent) => void;
}

export interface SubmitAndPollOptions extends PollCallOptions {
  request: CallSubmitRequest;
}

/** Parse a raw SSE buffer into discrete messages and a leftover partial block. */
function parseSseBuffer(buffer: string): {
  messages: SseMessage[];
  remaining: string;
} {
  const messages: SseMessage[] = [];
  const blocks = buffer.split("\n\n");
  // The last element may be an incomplete block; keep it for the next chunk.
  const remaining = blocks.pop() ?? "";

  for (const block of blocks) {
    if (block.trim() === "") continue;

    let id: string | undefined;
    let event: string | undefined;
    const dataParts: string[] = [];

    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue; // SSE comment
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const field = line.slice(0, colon);
      const value = line.slice(colon + 1).trimStart();
      if (field === "id") id = value;
      else if (field === "event") event = value;
      else if (field === "data") dataParts.push(value);
    }

    if (dataParts.length > 0) {
      messages.push({ id, event, data: dataParts.join("\n") });
    }
  }

  return { messages, remaining };
}

/** Client for outbound call submission and status polling. */
export class CallClient {
  private readonly endpoint: string;
  private readonly apiToken: string;
  private readonly submitPath: string;
  private readonly statusPathPrefix: string;
  private readonly ssePathPrefix: string;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly longPollWaitSecs: number;
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
    this.ssePathPrefix = options.ssePathPrefix ?? "/call/events";
    this.requestTimeoutMs = options.requestTimeoutMs ?? 20_000;
    this.maxRetries = options.maxRetries ?? 6;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 10_000;
    this.longPollWaitSecs = options.longPollWaitSecs ?? 30;
    this.fetchImpl = options.fetchImpl;
    this.sleepFn = options.sleepFn;
  }

  private get authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiToken}` };
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
      headers: this.authHeaders,
      timeoutMs: this.requestTimeoutMs,
      maxRetries: this.maxRetries,
      baseDelayMs: this.retryBaseMs,
      maxDelayMs: this.maxRetryDelayMs,
      fetchImpl: this.fetchImpl,
      sleepFn: this.sleepFn,
    });
  }

  /**
   * Poll status at a fixed interval until a terminal state or timeout.
   * Dispatches to {@link longPollStatus} or {@link sseStatus} when
   * `options.strategy` is set accordingly.
   */
  async pollStatus(options: PollCallOptions): Promise<PollResult> {
    const strategy = options.strategy ?? "poll";
    if (strategy === "long-poll") return this.longPollStatus(options);
    if (strategy === "sse") return this.sseStatus(options);

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

  /**
   * Wait for a terminal call status using long-polling.
   *
   * Each request includes a `?wait=N` query parameter asking the server to
   * hold the connection open for up to N seconds and return as soon as the
   * status changes (or the window expires). The client then reconnects
   * immediately, so there is no idle sleep between requests. This gives
   * near-real-time updates without requiring a persistent streaming connection.
   *
   * Falls back gracefully if the server ignores the `wait` parameter and
   * returns immediately — it simply loops faster than standard polling.
   */
  async longPollStatus(options: PollCallOptions): Promise<PollResult> {
    const deadline = Date.now() + options.timeoutMs;
    let attempt = 0;
    let lastPayload: CallStatusResponse = { status: "unknown" };

    // Give the HTTP timeout enough headroom beyond the server-side wait window.
    const longPollTimeoutMs = Math.max(
      this.requestTimeoutMs,
      this.longPollWaitSecs * 1000 + 5_000
    );

    while (Date.now() <= deadline) {
      attempt += 1;
      const atMs = Date.now();
      try {
        const payload = await requestJsonWithRetry<CallStatusResponse>({
          endpoints: [this.endpoint],
          path: `${this.statusPathPrefix}/${encodeURIComponent(options.source)}?wait=${String(this.longPollWaitSecs)}`,
          method: "GET",
          headers: this.authHeaders,
          timeoutMs: longPollTimeoutMs,
          // No internal retries; the outer loop handles reconnection.
          maxRetries: 0,
          baseDelayMs: this.retryBaseMs,
          maxDelayMs: this.maxRetryDelayMs,
          fetchImpl: this.fetchImpl,
          sleepFn: this.sleepFn,
        });

        lastPayload = payload;
        options.onPoll?.({ attempt, atMs, status: payload.status });

        if (TERMINAL_STATUSES.has(payload.status)) {
          return {
            status: payload.status as PollResult["status"],
            payload,
          };
        }
        // Server responded (wait expired or status updated); reconnect immediately.
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.onPoll?.({ attempt, atMs, status: "error", error: message });

        // Brief pause before retrying on error.
        const delay = Math.min(this.retryBaseMs, deadline - Date.now());
        if (delay > 0) await this.sleep(delay);
      }
    }

    return { status: "timeout", payload: lastPayload };
  }

  /**
   * Wait for a terminal call status using Server-Sent Events (SSE).
   *
   * Opens a persistent HTTP connection to the SSE endpoint and receives
   * status updates as they are pushed by the server. Automatically
   * reconnects if the stream drops before a terminal status is received.
   */
  async sseStatus(options: PollCallOptions): Promise<PollResult> {
    const deadline = Date.now() + options.timeoutMs;
    let attempt = 0;
    let lastPayload: CallStatusResponse = { status: "unknown" };
    const fetchFn = this.fetchImpl ?? fetch;

    while (Date.now() < deadline) {
      attempt += 1;
      const atMs = Date.now();
      const remainingMs = deadline - atMs;
      const url = joinUrl(
        this.endpoint,
        `${this.ssePathPrefix}/${encodeURIComponent(options.source)}`
      );

      let response: Response;
      try {
        response = await fetchFn(url, {
          method: "GET",
          headers: {
            ...this.authHeaders,
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          signal: AbortSignal.timeout(remainingMs),
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "AbortError" || error.name === "TimeoutError")
        ) {
          break; // overall deadline reached
        }
        const message = error instanceof Error ? error.message : String(error);
        options.onPoll?.({ attempt, atMs, status: "error", error: message });
        const delay = Math.min(this.retryBaseMs * 2, deadline - Date.now());
        if (delay > 0) await this.sleep(delay);
        continue;
      }

      if (!response.ok) {
        let body = "";
        try {
          body = await response.text();
        } catch {
          // ignore
        }
        const err = new HttpRequestError(this.endpoint, response.status, body);
        options.onPoll?.({
          attempt,
          atMs,
          status: "error",
          error: err.message,
        });
        const delay = Math.min(this.retryBaseMs * 2, deadline - Date.now());
        if (delay > 0) await this.sleep(delay);
        continue;
      }

      if (response.body == null) {
        options.onPoll?.({
          attempt,
          atMs,
          status: "error",
          error: "SSE response body is null",
        });
        const delay = Math.min(this.retryBaseMs * 2, deadline - Date.now());
        if (delay > 0) await this.sleep(delay);
        continue;
      }

      // Read and parse the SSE stream.
      const reader = (
        response.body as ReadableStream<Uint8Array>
      ).getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let terminal = false;

      try {
        while (Date.now() < deadline) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { messages, remaining } = parseSseBuffer(buffer);
          buffer = remaining;

          for (const msg of messages) {
            let payload: CallStatusResponse;
            try {
              payload = JSON.parse(msg.data) as CallStatusResponse;
            } catch {
              continue; // ignore non-JSON SSE messages (e.g. heartbeats)
            }

            lastPayload = payload;
            options.onPoll?.({
              attempt,
              atMs: Date.now(),
              status: payload.status,
            });

            if (TERMINAL_STATUSES.has(payload.status)) {
              terminal = true;
              return {
                status: payload.status as PollResult["status"],
                payload,
              };
            }
          }
        }
      } catch (streamError) {
        if (
          streamError instanceof Error &&
          (streamError.name === "AbortError" ||
            streamError.name === "TimeoutError")
        ) {
          terminal = true; // treat as deadline expiry
        }
        // Non-abort stream errors: fall through to reconnect
      } finally {
        reader.cancel().catch(() => {
          // ignore cancel errors during cleanup
        });
      }

      if (terminal) break;
      // Stream ended without a terminal status; reconnect if time remains.
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
