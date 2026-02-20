/** OAuth2 client credentials or password grant. */
export interface OAuth2Auth {
  readonly type: "oauth2";
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly audience?: string;
  readonly scope?: string;
  readonly grantType?: "client_credentials" | "password";
  readonly username?: string;
  readonly password?: string;
}

/** Static bearer token. */
export interface BearerAuth {
  readonly type: "bearer";
  readonly token: string;
}

/** Async token generator with optional cache duration. */
export interface TokenGeneratorAuth {
  readonly type: "generator";
  readonly generate: () => Promise<string>;
  readonly cacheDurationMs?: number;
}

/** No authentication. */
export interface NoAuth {
  readonly type: "none";
}

export type AuthConfig = OAuth2Auth | BearerAuth | TokenGeneratorAuth | NoAuth;

export interface RetryConfig {
  /** Number of retries after the initial attempt. */
  readonly maxAttempts: number;
  /** Delay between retries in milliseconds. */
  readonly delayMs: number;
  /** Additional HTTP status codes to retry on (5xx and network errors are always retried). */
  readonly retryableStatuses?: readonly number[];
  /** Custom retryable check. Called with the status code and parsed response body. */
  readonly isRetryable?: (
    status: number,
    body: Record<string, unknown>
  ) => boolean;
}

/**
 * Minimal logger interface. Structurally compatible with `@hardlydifficult/logger`'s Logger class.
 * All methods are optional -- only implement what you need.
 */
export interface RestClientLogger {
  debug?(message: string, context?: Record<string, unknown>): void;
  info?(message: string, context?: Record<string, unknown>): void;
  warn?(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}

export interface RestClientConfig {
  readonly baseUrl: string;
  readonly auth?: AuthConfig;
  readonly retry?: RetryConfig;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
  readonly logger?: RestClientLogger;
}

export type HttpMethod = "GET" | "POST" | "DELETE" | "PATCH" | "PUT";
