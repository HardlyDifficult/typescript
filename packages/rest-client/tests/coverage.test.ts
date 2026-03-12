/**
 * Additional tests to achieve 100% coverage for rest-client package.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

import { AuthenticationManager } from "../src/AuthenticationManager.js";
import { HttpClient } from "../src/HttpClient.js";
import { defineOperation, operation } from "../src/Operation.js";
import { RestClient, createRestClient } from "../src/RestClient.js";
import {
  AuthenticationError,
  ConfigurationError,
  HttpError,
  NetworkError,
} from "../src/errors.js";
import * as indexExports from "../src/index.js";

// ---------------------------------------------------------------------------
// Mock axios (same pattern as HttpClient.test.ts)
// ---------------------------------------------------------------------------

const { mockInstance } = vi.hoisted(() => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    defaults: { headers: { common: {} as Record<string, string | undefined> } },
  };
  return { mockInstance };
});

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockInstance),
    isAxiosError: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedAxios = vi.mocked(axios, true);

// ---------------------------------------------------------------------------
// index.ts — importing ensures re-exports are counted
// ---------------------------------------------------------------------------

describe("index re-exports", () => {
  it("exports all expected symbols", () => {
    expect(indexExports.RestClient).toBeDefined();
    expect(indexExports.createRestClient).toBeDefined();
    expect(indexExports.defineOperation).toBeDefined();
    expect(indexExports.operation).toBeDefined();
    expect(indexExports.validateParams).toBeDefined();
    expect(indexExports.AuthenticationManager).toBeDefined();
    expect(indexExports.HttpClient).toBeDefined();
    expect(indexExports.ConfigurationError).toBeDefined();
    expect(indexExports.NetworkError).toBeDefined();
    expect(indexExports.HttpError).toBeDefined();
    expect(indexExports.AuthenticationError).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AuthenticationManager — line 50: unsupported auth type (default switch)
// ---------------------------------------------------------------------------

describe("AuthenticationManager unsupported auth type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws AuthenticationError for unsupported auth type", async () => {
    const mgr = new AuthenticationManager({ type: "magic" } as never);
    await expect(mgr.authenticate()).rejects.toThrow(AuthenticationError);
    await expect(mgr.authenticate()).rejects.toThrow("Unsupported auth type");
  });

  // line 108-109: password grant with valid username/password
  it("sends username and password for password grant with valid credentials", async () => {
    mockedAxios.post.mockResolvedValue({
      data: { access_token: "pw-token" },
    });

    const mgr = new AuthenticationManager({
      type: "oauth2",
      tokenUrl: "https://auth.example.com/token",
      clientId: "cid",
      grantType: "password",
      username: "user@example.com",
      password: "s3cr3t",
    });

    const token = await mgr.authenticate();
    expect(token).toBe("pw-token");

    const body = mockedAxios.post.mock.calls[0]![1] as string;
    expect(body).toContain("grant_type=password");
    expect(body).toContain("username=user%40example.com");
    expect(body).toContain("password=s3cr3t");
  });

  // line 164: non-Axios error in OAuth2 flow
  it("throws AuthenticationError when a non-Axios error occurs", async () => {
    mockedAxios.post.mockRejectedValue(new Error("connection refused"));
    mockedAxios.isAxiosError.mockReturnValue(false);

    const mgr = new AuthenticationManager({
      type: "oauth2",
      tokenUrl: "https://auth.example.com/token",
      clientId: "cid",
    });

    await expect(mgr.authenticate()).rejects.toThrow(AuthenticationError);
    await expect(mgr.authenticate()).rejects.toThrow("connection refused");
  });

  it("throws AuthenticationError when a non-Error object is thrown in OAuth2", async () => {
    mockedAxios.post.mockRejectedValue("a string error");
    mockedAxios.isAxiosError.mockReturnValue(false);

    const mgr = new AuthenticationManager({
      type: "oauth2",
      tokenUrl: "https://auth.example.com/token",
      clientId: "cid",
    });

    await expect(mgr.authenticate()).rejects.toThrow(AuthenticationError);
  });

  // line 153: Axios error without response.data → uses error.message
  it("uses error.message when Axios error has no response.data", async () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 401,
        statusText: "Unauthorized",
        // no data property
      },
      message: "Request failed with status code 401",
    };
    mockedAxios.post.mockRejectedValue(axiosError);
    mockedAxios.isAxiosError.mockReturnValue(true);

    const mgr = new AuthenticationManager({
      type: "oauth2",
      tokenUrl: "https://auth.example.com/token",
      clientId: "cid",
    });

    await expect(mgr.authenticate()).rejects.toThrow(HttpError);
    await expect(mgr.authenticate()).rejects.toThrow(
      "Request failed with status code 401"
    );
  });

  // line 180: isTokenValid — lifetimeMs !== null branch (Math.min calculation)
  it("uses Math.min buffer when lifetimeMs is not null (token with expiry)", async () => {
    mockedAxios.post.mockResolvedValue({
      data: { access_token: "valid-token", expires_in: 3600 },
    });

    const mgr = new AuthenticationManager({
      type: "oauth2",
      tokenUrl: "https://auth.example.com/token",
      clientId: "cid",
    });

    // First call — acquires token with expiry
    const token1 = await mgr.authenticate();
    expect(token1).toBe("valid-token");

    // Second call — token is valid, returns cached (exercises line 180 — lifetimeMs != null)
    const token2 = await mgr.authenticate();
    expect(token2).toBe("valid-token");
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// HttpClient — coverage for error formatting branches
// ---------------------------------------------------------------------------

describe("HttpClient error formatting", () => {
  let client: HttpClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockInstance.defaults = { headers: { common: {} } };
    client = new HttpClient({ retry: { maxAttempts: 0, delayMs: 1 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes context summary in error message", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 422,
        statusText: "Unprocessable Entity",
        data: {
          context: { field: "email", value: "not-valid" },
        },
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    try {
      await client.get("https://api.test/bad");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).toContain("context:");
      expect((e as HttpError).message).toContain("email");
    }
  });

  it("omits context from error when context is an array", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        statusText: "Bad Request",
        data: { context: ["item1", "item2"] },
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    try {
      await client.get("https://api.test/array-ctx");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).not.toContain("context:");
    }
  });

  it("omits context from error when context is null", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        statusText: "Bad Request",
        data: { context: null },
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    try {
      await client.get("https://api.test/null-ctx");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).not.toContain("context:");
    }
  });

  it("handles null response data (falls back to empty object)", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 500,
        statusText: "Server Error",
        data: null,
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    await expect(
      client.get("https://api.test/null-data")
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("wraps non-Error non-Axios object as NetworkError", async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    mockInstance.get.mockRejectedValue("plain string error");

    await expect(client.get("https://api.test/fail")).rejects.toBeInstanceOf(
      NetworkError
    );
  });

  // line 125: error.code !== undefined → { code: error.code } (the truthy branch)
  it("includes error.code in NetworkError when code is present", async () => {
    const networkError = {
      isAxiosError: true,
      response: undefined, // no response
      message: "ECONNRESET",
      code: "ECONNRESET", // code is defined → exercises truthy branch at line 125
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(networkError);

    const err = await client.get("https://api.test/conn-reset").catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    // NetworkError is constructed with context: { code: "ECONNRESET" }
    expect((err as NetworkError).context).toEqual({ code: "ECONNRESET" });
  });

  // line 125: error.code === undefined → undefined passed to NetworkError (the false branch)
  it("passes undefined to NetworkError context when code is absent", async () => {
    const networkError = {
      isAxiosError: true,
      response: undefined,
      message: "socket hang up",
      code: undefined, // no code → false branch at line 125
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(networkError);

    const err = await client.get("https://api.test/no-code").catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as NetworkError).context).toBeUndefined();
  });

  // line 83-84: retry warn — non-Axios error logs String(error)
  it("logs String(error) in retry warning for non-Axios NetworkError", async () => {
    const networkError = new NetworkError("connection dropped");
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    const warn = vi.fn();
    const retryClient = new HttpClient({
      logger: { warn },
      retry: { maxAttempts: 1, delayMs: 1 },
    });
    mockInstance.get
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ data: "ok" });

    const promise = retryClient.get("https://api.test/retry");
    await vi.advanceTimersByTimeAsync(10);
    await promise;

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("retrying"),
      expect.objectContaining({ error: expect.any(String) })
    );
  });

  // line 84: (error.response?.status ?? "network") — "network" fallback when status is undefined
  it("logs 'network' in retry warning for Axios error without response", async () => {
    const axiosNetworkError = {
      isAxiosError: true,
      response: undefined, // no response — exercises ??"network"
      message: "ECONNREFUSED",
      code: "ECONNREFUSED",
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const warn = vi.fn();
    const retryClient = new HttpClient({
      logger: { warn },
      retry: { maxAttempts: 1, delayMs: 1 },
    });
    mockInstance.get
      .mockRejectedValueOnce(axiosNetworkError)
      .mockResolvedValueOnce({ data: "ok" });

    const promise = retryClient.get("https://api.test/network-err");
    await vi.advanceTimersByTimeAsync(10);
    await promise;

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("retrying"),
      expect.objectContaining({ error: "network" })
    );
  });

  // line 113: isRetryable with data ?? {} when response.data is undefined
  it("passes empty object to isRetryable when response.data is undefined", async () => {
    // Use status 422 (not 5xx so won't auto-retry) with custom isRetryable
    // and data: undefined so line 113 exercises ?? {}
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 422,
        statusText: "Unprocessable Entity",
        data: undefined, // exercises ?? {}
      },
      message: "Unprocessable",
      code: undefined,
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const isRetryable = vi.fn().mockReturnValue(false);
    const retryClient = new HttpClient({
      retry: { maxAttempts: 1, delayMs: 1, isRetryable },
    });
    mockInstance.get.mockRejectedValue(axiosError);

    await expect(
      retryClient.get("https://api.test/no-data")
    ).rejects.toBeInstanceOf(HttpError);
    // isRetryable was called with the 422 status and empty object (data ?? {})
    expect(isRetryable).toHaveBeenCalledWith(422, {});
  });

  // line 153: cause shorter than CAUSE_TRUNCATE — no "..." appended
  it("includes short cause without truncation", async () => {
    const shortCause = "short cause message";
    const error = {
      isAxiosError: true,
      response: {
        status: 500,
        statusText: "Internal Server Error",
        data: {
          message: "Something went wrong",
          cause: shortCause,
        },
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    try {
      await client.get("https://api.test/short-cause");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).toContain(`cause: ${shortCause}`);
      expect((e as HttpError).message).not.toContain("...");
    }
  });

  // formatContextSummary: empty object returns undefined → no context in message
  it("formatContextSummary returns undefined for empty context object", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        statusText: "Bad Request",
        data: { context: {} },
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    try {
      await client.get("https://api.test/empty-ctx");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).not.toContain("context:");
    }
  });

  // stringifyValue: null values in context
  it("stringifyValue renders null values in context as 'null'", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          context: {
            nullField: null,
            numberField: 42,
          },
        },
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    try {
      await client.get("https://api.test/null-ctx");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).toContain("nullField=null");
    }
  });

  // stringifyValue: undefined values
  it("stringifyValue renders undefined values in context as 'undefined'", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          context: {
            undefinedField: undefined,
          },
        },
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    try {
      await client.get("https://api.test/undef-ctx");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).toContain("undefinedField=undefined");
    }
  });

  // context values longer than 50 chars are truncated
  it("truncates long context values with '...'", async () => {
    const longValue = "v".repeat(100);
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: { context: { key: longValue } },
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    try {
      await client.get("https://api.test/long-ctx");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).toContain("...");
    }
  });

  // safeStringify: circular reference → catch block → "[Object]"
  it("safeStringify returns [Object] for circular references", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: { context: { circular } },
      },
    };
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    mockInstance.get.mockRejectedValue(error);

    try {
      await client.get("https://api.test/circular");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).toContain("[Object]");
    }
  });

  // NetworkError instance retries
  it("retries when error is a NetworkError instance", async () => {
    const networkError = new NetworkError("connection failed");
    vi.mocked(axios.isAxiosError).mockReturnValue(false);
    const retryClient = new HttpClient({
      retry: { maxAttempts: 1, delayMs: 1 },
    });
    mockInstance.get
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ data: "ok" });

    const promise = retryClient.get("https://api.test/retry");
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;
    expect(result).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Operation.ts — lines 95-105: operation.delete, operation.patch, operation.put
// ---------------------------------------------------------------------------

describe("operation factory methods", () => {
  it("operation.delete returns DELETE config", () => {
    const config = operation.delete<void>({ path: "/items/1" });
    expect(config.method).toBe("DELETE");
  });

  it("operation.patch returns PATCH config", () => {
    const config = operation.patch<{ updated: boolean }>({ path: "/items/1" });
    expect(config.method).toBe("PATCH");
  });

  it("operation.put returns PUT config", () => {
    const config = operation.put<{ replaced: boolean }>({ path: "/items/1" });
    expect(config.method).toBe("PUT");
  });
});

// ---------------------------------------------------------------------------
// RestClient.ts — line 70 (defaultHeaders), 83 (getLogger), 186 (unsupported
//                 method), 246 (no path/url), 261 (invalid URL)
// ---------------------------------------------------------------------------

describe("RestClient additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstance.defaults = { headers: { common: {} } };
  });

  it("passes defaultHeaders to HttpClient when provided (line 70 truthy branch)", () => {
    // Just constructing is enough to cover the conditional; no error expected
    const client = new RestClient({
      baseUrl: "https://api.test",
      defaultHeaders: { "X-Api-Key": "my-key" },
      retry: { maxAttempts: 0, delayMs: 1 },
    });
    expect(client.getBaseUrl()).toBe("https://api.test");
  });

  it("getLogger() returns the logger when configured (line 83)", () => {
    const logger = { debug: vi.fn() };
    const client = new RestClient({ baseUrl: "https://api.test", logger });
    expect(client.getLogger()).toBe(logger);
  });

  it("getLogger() returns undefined when not configured", () => {
    const client = new RestClient({ baseUrl: "https://api.test" });
    expect(client.getLogger()).toBeUndefined();
  });

  it("throws ConfigurationError for unsupported HTTP method (line 186)", async () => {
    const client = new RestClient({ baseUrl: "https://api.test" });
    const badConfig = { method: "INVALID" as never, path: "/test" };
    const bound = client.bind(badConfig);
    await expect(bound()).rejects.toThrow(ConfigurationError);
    await expect(bound()).rejects.toThrow("Unsupported HTTP method");
  });

  it("throws ConfigurationError when operation has neither path nor url (line 246)", async () => {
    const client = new RestClient({ baseUrl: "https://api.test" });
    const noPathConfig = { method: "GET" as const } as never;
    const bound = client.bind(noPathConfig);
    await expect(bound()).rejects.toThrow(ConfigurationError);
    await expect(bound()).rejects.toThrow(
      "Operation requires either path or url"
    );
  });

  it("throws ConfigurationError when baseUrl is invalid (line 261)", async () => {
    const client = new RestClient({
      baseUrl: "not-a-valid-url",
      retry: { maxAttempts: 0, delayMs: 1 },
    });
    const bound = client.bind(
      defineOperation({ method: "GET", path: "/test" })
    );
    await expect(bound()).rejects.toThrow(ConfigurationError);
  });

  it("uses absolute URL as-is when URL starts with protocol", async () => {
    const client = new RestClient({
      baseUrl: "https://api.test",
      retry: { maxAttempts: 0, delayMs: 1 },
    });
    mockInstance.get.mockResolvedValue({ data: { ok: true } });

    const absoluteOp = defineOperation({
      method: "GET",
      url: () => "https://other.api.com/data",
    });

    const bound = client.bind(absoluteOp);
    await bound();
    expect(mockInstance.get).toHaveBeenCalledWith("https://other.api.com/data");
  });

  it("path without leading slash is resolved correctly", async () => {
    const client = createRestClient(
      { baseUrl: "https://api.test/v1", retry: { maxAttempts: 0, delayMs: 1 } },
      { getNoSlash: defineOperation({ method: "GET", path: "users/1" }) }
    );
    mockInstance.get.mockResolvedValue({ data: {} });

    await client.getNoSlash();
    expect(mockInstance.get).toHaveBeenCalledWith(
      "https://api.test/v1/users/1"
    );
  });

  it("path with leading slash is resolved correctly", async () => {
    const client = createRestClient(
      { baseUrl: "https://api.test/v1", retry: { maxAttempts: 0, delayMs: 1 } },
      { getWithSlash: defineOperation({ method: "GET", path: "/users/1" }) }
    );
    mockInstance.get.mockResolvedValue({ data: {} });

    await client.getWithSlash();
    expect(mockInstance.get).toHaveBeenCalledWith(
      "https://api.test/v1/users/1"
    );
  });

  it("baseUrl already ending with slash resolves path correctly", async () => {
    const client = createRestClient(
      {
        baseUrl: "https://api.test/v1/",
        retry: { maxAttempts: 0, delayMs: 1 },
      },
      { getIt: defineOperation({ method: "GET", path: "/users" }) }
    );
    mockInstance.get.mockResolvedValue({ data: [] });

    await client.getIt();
    expect(mockInstance.get).toHaveBeenCalledWith("https://api.test/v1/users");
  });
});
