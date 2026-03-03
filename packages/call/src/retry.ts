export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RequestWithRetryOptions {
  endpoints: readonly string[];
  path: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  fetchImpl?: FetchLike;
  sleepFn?: (ms: number) => Promise<void>;
}

/** Error representing a non-2xx HTTP response. */
export class HttpRequestError extends Error {
  readonly endpoint: string;
  readonly status: number;
  readonly responseBody: string;

  constructor(endpoint: string, status: number, responseBody: string) {
    super(`HTTP ${String(status)} from ${endpoint}`);
    this.endpoint = endpoint;
    this.status = status;
    this.responseBody = responseBody;
  }
}

/** Error representing an invalid JSON response payload. */
export class JsonParseError extends Error {
  readonly endpoint: string;
  readonly responseBody: string;

  constructor(endpoint: string, responseBody: string, cause: unknown) {
    super(`Invalid JSON response from ${endpoint}`, { cause });
    this.endpoint = endpoint;
    this.responseBody = responseBody;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpRequestError) {
    return isRetryableStatus(error.status);
  }
  if (error instanceof JsonParseError) {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    return error.name === "AbortError" || error.name === "TimeoutError";
  }
  return false;
}

function calculateDelayMs(
  baseDelayMs: number,
  maxDelayMs: number,
  attempt: number,
): number {
  const rawDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.floor(rawDelay * Math.random() * 0.4);
  return rawDelay + jitter;
}

function joinUrl(endpoint: string, path: string): string {
  const base = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * Executes an HTTP request with retry, exponential backoff, and endpoint failover.
 */
export async function requestJsonWithRetry<T>(
  options: RequestWithRetryOptions,
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepFn = options.sleepFn ?? sleep;

  if (options.endpoints.length === 0) {
    throw new Error("At least one endpoint is required");
  }

  const maxAttempts = options.maxRetries + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const endpoint =
      options.endpoints[attempt % options.endpoints.length] ??
      options.endpoints[0];

    try {
      const response = await fetchImpl(joinUrl(endpoint, options.path), {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: AbortSignal.timeout(options.timeoutMs),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new HttpRequestError(endpoint, response.status, text);
      }

      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new JsonParseError(endpoint, text, error);
      }
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attempt < maxAttempts - 1 && isRetryableError(error);
      if (!shouldRetry) {
        throw error;
      }

      const delayMs = calculateDelayMs(
        options.baseDelayMs,
        options.maxDelayMs,
        attempt,
      );
      await sleepFn(delayMs);
    }
  }

  throw new Error(
    `Request failed after ${String(maxAttempts)} attempts`,
    { cause: lastError },
  );
}
