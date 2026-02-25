import { AuthenticationManager } from "./AuthenticationManager.js";
import { ConfigurationError } from "./errors.js";
import { HttpClient } from "./HttpClient.js";
import { type OperationConfig, validateParams } from "./Operation.js";
import type {
  HttpMethod,
  RestClientConfig,
  RestClientLogger,
} from "./types.js";

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
  bind<Params, Response>(
    config: OperationConfig<Params, Response>
  ): (params: Params) => Promise<Response> {
    return async (params: Params) => {
      const validated = validateParams(params, config.params);
      const url = config.url(validated, this.getBaseUrl());
      const response = await this.executeMethod<Response>(
        config.method,
        url,
        config.body?.(validated)
      );
      return config.transform !== undefined
        ? config.transform(response)
        : response;
    };
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
    await this.authenticate();
    return this.httpClient.get<T>(url);
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    await this.authenticate();
    return this.httpClient.post<T>(url, data);
  }

  async delete<T>(url: string): Promise<T> {
    await this.authenticate();
    return this.httpClient.delete<T>(url);
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    await this.authenticate();
    return this.httpClient.patch<T>(url, data);
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    await this.authenticate();
    return this.httpClient.put<T>(url, data);
  }

  private async executeMethod<T>(
    method: HttpMethod,
    url: string,
    data?: unknown
  ): Promise<T> {
    await this.authenticate();
    switch (method) {
      case "GET":
        return this.httpClient.get<T>(url);
      case "POST":
        return this.httpClient.post<T>(url, data);
      case "DELETE":
        return this.httpClient.delete<T>(url);
      case "PATCH":
        return this.httpClient.patch<T>(url, data);
      case "PUT":
        return this.httpClient.put<T>(url, data);
      default:
        throw new ConfigurationError(
          `Unsupported HTTP method: ${method as string}`
        );
    }
  }
}
