import { z } from "zod";

import { AuthenticationManager } from "./AuthenticationManager.js";
import { ConfigurationError } from "./errors.js";
import { HttpClient } from "./HttpClient.js";
import {
  type BoundOperation,
  type OperationConfig,
  validateParams,
} from "./Operation.js";
import type {
  HttpMethod,
  RestClientConfig,
  RestClientLogger,
} from "./types.js";

const NO_PARAMS_SCHEMA = z.void();
const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

export type AnyOperationConfig = OperationConfig<unknown, unknown, unknown>;
export type OperationMap = Record<string, AnyOperationConfig>;

export type BoundOperations<TOperations extends OperationMap> = {
  [Name in keyof TOperations]: TOperations[Name] extends OperationConfig<
    infer Params,
    infer Response,
    infer _RawResponse
  >
    ? BoundOperation<Params, Response>
    : never;
};

export type RestClientApi<TOperations extends OperationMap> = RestClient &
  BoundOperations<TOperations>;

/**
 * Opinionated REST client with OAuth2, retries, and declarative operations.
 *
 * @example
 *   class MyApi extends RestClient {
 *     getUser = this.bind(GetUser);
 *     createUser = this.bind(CreateUser);
 *   }
 *
 *   const api = new MyApi({
 *     baseUrl: "https://api.example.com",
 *     auth: { type: "oauth2", tokenUrl: "...", clientId: "...", clientSecret: "..." },
 *   });
 *
 *   const user = await api.getUser({ id: "123" });
 */
export class RestClient {
  private readonly httpClient: HttpClient;
  private readonly authManager: AuthenticationManager;
  private readonly config: RestClientConfig;

  constructor(config: RestClientConfig) {
    if (config.baseUrl === "") {
      throw new ConfigurationError("baseUrl is required");
    }

    this.config = config;
    this.authManager = new AuthenticationManager(
      config.auth ?? { type: "none" },
      config.logger
    );
    this.httpClient = new HttpClient({
      logger: config.logger,
      retry: config.retry,
      defaultHeaders: config.defaultHeaders
        ? { ...config.defaultHeaders }
        : undefined,
    });
  }

  /** Base URL for all requests. */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /** Logger instance, if configured. */
  getLogger(): RestClientLogger | undefined {
    return this.config.logger;
  }

  /**
   * Bind a declarative operation to this client, returning a typed function.
   *
   * @example
   *   class MyApi extends RestClient {
   *     getUser = this.bind(GetUser);
   *   }
   */
  bind<Params = undefined, Response = unknown, RawResponse = Response>(
    config: OperationConfig<Params, Response, RawResponse>
  ): BoundOperation<Params, Response> {
    const bound = async (params?: Params): Promise<Response> => {
      const validated = validateParams(
        params as Params,
        getParamsSchema(config.params)
      );
      const url = resolveOperationUrl(config, validated, this.getBaseUrl());
      const response = await this.executeMethod<RawResponse>(
        config.method,
        url,
        config.body?.(validated)
      );
      const parser = config.parse ?? config.transform;
      return parser !== undefined
        ? parser(response, validated)
        : (response as Response);
    };

    return bound as BoundOperation<Params, Response>;
  }

  /** Authenticate and set the bearer token for subsequent requests. */
  async authenticate(): Promise<string> {
    const token = await this.authManager.authenticate();
    if (token !== "") {
      this.httpClient.setBearerToken(token);
    }
    return token;
  }

  /** Clear the cached token, forcing re-authentication on next request. */
  clearToken(): void {
    this.authManager.clearToken();
    this.httpClient.clearBearerToken();
  }

  /** Token expiry timestamp (ms since epoch), or null if unavailable. */
  getTokenExpiryTime(): number | null {
    return this.authManager.getTokenExpiryTime();
  }

  /** Token issue timestamp (ms since epoch), or null if unavailable. */
  getTokenIssuedAt(): number | null {
    return this.authManager.getTokenIssuedAt();
  }

  /** Token lifetime in milliseconds, or null if unavailable. */
  getTokenLifetimeMs(): number | null {
    return this.authManager.getTokenLifetimeMs();
  }

  async get<T>(url: string): Promise<T> {
    return this.executeMethod("GET", url);
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    return this.executeMethod("POST", url, data);
  }

  async delete<T>(url: string): Promise<T> {
    return this.executeMethod("DELETE", url);
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    return this.executeMethod("PATCH", url, data);
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    return this.executeMethod("PUT", url, data);
  }

  private async executeMethod<T>(
    method: HttpMethod,
    url: string,
    data?: unknown
  ): Promise<T> {
    await this.authenticate();
    const resolvedUrl = this.resolveUrl(url);
    switch (method) {
      case "GET":
        return this.httpClient.get<T>(resolvedUrl);
      case "POST":
        return this.httpClient.post<T>(resolvedUrl, data);
      case "DELETE":
        return this.httpClient.delete<T>(resolvedUrl);
      case "PATCH":
        return this.httpClient.patch<T>(resolvedUrl, data);
      case "PUT":
        return this.httpClient.put<T>(resolvedUrl, data);
      default:
        throw new ConfigurationError(
          `Unsupported HTTP method: ${method as string}`
        );
    }
  }

  private resolveUrl(url: string): string {
    return resolveUrl(this.getBaseUrl(), url);
  }
}

/** Create a RestClient instance with operation configs bound as typed methods. */
export function createRestClient<TOperations extends OperationMap>(
  config: RestClientConfig,
  operations: TOperations
): RestClientApi<TOperations> {
  const client = new RestClient(config) as RestClientApi<TOperations>;

  for (const [name, operation] of Object.entries(operations) as [
    keyof TOperations & string,
    TOperations[keyof TOperations],
  ][]) {
    if (name in client) {
      throw new ConfigurationError(
        `Operation name "${name}" conflicts with an existing RestClient property`
      );
    }

    Object.defineProperty(client, name, {
      configurable: false,
      enumerable: true,
      value: client.bind(operation),
      writable: false,
    });
  }

  return client;
}

function getParamsSchema<Params>(
  schema?: OperationConfig<Params, unknown, unknown>["params"]
): z.ZodType<Params> {
  return (schema ?? NO_PARAMS_SCHEMA) as z.ZodType<Params>;
}

function resolveOperationUrl<Params, Response, RawResponse>(
  config: OperationConfig<Params, Response, RawResponse>,
  params: Params,
  baseUrl: string
): string {
  if (config.path !== undefined) {
    const path =
      typeof config.path === "function" ? config.path(params) : config.path;
    return resolveUrl(baseUrl, path);
  }

  if (config.url !== undefined) {
    return resolveUrl(baseUrl, config.url(params, baseUrl));
  }

  throw new ConfigurationError("Operation requires either path or url");
}

function resolveUrl(baseUrl: string, urlOrPath: string): string {
  if (ABSOLUTE_URL_PATTERN.test(urlOrPath)) {
    return urlOrPath;
  }

  try {
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const normalizedPath = urlOrPath.startsWith("/")
      ? urlOrPath.slice(1)
      : urlOrPath;
    return new URL(normalizedPath, normalizedBaseUrl).toString();
  } catch {
    throw new ConfigurationError(
      `Invalid URL or path: ${urlOrPath} (baseUrl: ${baseUrl})`
    );
  }
}
