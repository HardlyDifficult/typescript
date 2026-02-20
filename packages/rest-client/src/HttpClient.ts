import axios, { type AxiosInstance } from "axios";

import { HttpError, NetworkError } from "./errors";
import type { RestClientLogger, RetryConfig } from "./types";

const DEFAULT_RETRY: Required<Pick<RetryConfig, "maxAttempts" | "delayMs">> = {
  maxAttempts: 3,
  delayMs: 6000,
};

const CAUSE_TRUNCATE = 200;
const CONTEXT_VALUE_TRUNCATE = 50;
const MAX_CONTEXT_KEYS = 3;

/** HTTP client with automatic retries and structured error formatting. */
export class HttpClient {
  private readonly instance: AxiosInstance;
  private readonly logger: RestClientLogger | undefined;
  private readonly retry: RetryConfig;

  constructor(options?: {
    logger?: RestClientLogger;
    retry?: RetryConfig;
    defaultHeaders?: Record<string, string>;
  }) {
    this.instance = axios.create({
      headers: {
        "Content-Type": "application/json",
        ...options?.defaultHeaders,
      },
    });
    this.logger = options?.logger;
    this.retry = { ...DEFAULT_RETRY, ...options?.retry };
  }

  setBearerToken(token: string): void {
    this.instance.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  clearBearerToken(): void {
    delete this.instance.defaults.headers.common.Authorization;
  }

  async get<T>(url: string): Promise<T> {
    return this.withRetry("GET", url, () => this.instance.get<T>(url));
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    return this.withRetry("POST", url, () => this.instance.post<T>(url, data));
  }

  async delete<T>(url: string): Promise<T> {
    return this.withRetry("DELETE", url, () => this.instance.delete<T>(url));
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    return this.withRetry("PATCH", url, () =>
      this.instance.patch<T>(url, data)
    );
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    return this.withRetry("PUT", url, () => this.instance.put<T>(url, data));
  }

  private async withRetry<T>(
    method: string,
    url: string,
    fn: () => Promise<{ data: T }>,
    attempt = 0
  ): Promise<T> {
    try {
      const response = await fn();
      this.logger?.debug?.(`${method} ${url}`, {
        status: (response as { status?: number }).status ?? 200,
      });
      return response.data;
    } catch (error) {
      if (attempt < this.retry.maxAttempts && this.isRetryable(error)) {
        this.logger?.warn?.(
          `${method} ${url} failed, retrying (${String(attempt + 1)}/${String(this.retry.maxAttempts)})`,
          {
            error: axios.isAxiosError(error)
              ? (error.response?.status ?? "network")
              : String(error),
          }
        );
        await sleep(this.retry.delayMs);
        return this.withRetry(method, url, fn, attempt + 1);
      }
      throw this.toTypedError(error);
    }
  }

  private isRetryable(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return error instanceof NetworkError;
    }

    const status = error.response?.status;
    if (status === undefined) {
      return true;
    }
    if (status >= 500 && status < 600) {
      return true;
    }

    if (this.retry.retryableStatuses?.includes(status) === true) {
      return true;
    }

    if (this.retry.isRetryable !== undefined) {
      const body = (error.response?.data ?? {}) as Record<string, unknown>;
      return this.retry.isRetryable(status, body);
    }

    return false;
  }

  private toTypedError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      if (error.response === undefined) {
        return new NetworkError(
          `Request failed: ${error.message}`,
          error.code !== undefined ? { code: error.code } : undefined,
        );
      }

      const {status} = error.response;
      const {statusText} = error.response;
      const data = ((error.response.data as Record<string, unknown> | null) ??
        {});
      const code = typeof data.code === "string" ? data.code : undefined;
      const message =
        typeof data.message === "string" ? data.message : undefined;
      const cause = typeof data.cause === "string" ? data.cause : undefined;
      const context =
        typeof data.context === "object" &&
        data.context !== null &&
        !Array.isArray(data.context)
          ? (data.context as Record<string, unknown>)
          : undefined;

      let msg = `HTTP ${String(status)}`;
      if (code !== undefined) {
        msg += `: ${code}`;
      }
      if (message !== undefined) {
        msg += ` - ${message}`;
      }
      if (cause !== undefined) {
        const truncated =
          cause.length > CAUSE_TRUNCATE
            ? `${cause.substring(0, CAUSE_TRUNCATE)}...`
            : cause;
        msg += ` (cause: ${truncated})`;
      }
      if (context !== undefined) {
        const summary = formatContextSummary(context);
        if (summary !== undefined) {
          msg += ` [context: ${summary}]`;
        }
      }

      return new HttpError(msg, status, statusText, data);
    }

    return new NetworkError(
      `Request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatContextSummary(
  obj: Record<string, unknown>
): string | undefined {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return undefined;
  }

  return keys
    .slice(0, MAX_CONTEXT_KEYS)
    .map((k) => {
      const v = obj[k];
      const str = stringifyValue(v);
      return `${k}=${str.length > CONTEXT_VALUE_TRUNCATE ? `${str.substring(0, CONTEXT_VALUE_TRUNCATE)}...` : str}`;
    })
    .join(", ");
}

function stringifyValue(v: unknown): string {
  if (typeof v === "string") {
    return v;
  }
  if (v === null) {
    return "null";
  }
  if (v === undefined) {
    return "undefined";
  }
  return safeStringify(v);
}

function safeStringify(v: unknown): string {
  try {
    const result = JSON.stringify(v);
    return typeof result === "string" ? result : "[Object]";
  } catch {
    return "[Object]";
  }
}
