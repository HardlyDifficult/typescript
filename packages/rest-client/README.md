# @hardlydifficult/rest-client

A typed REST client library with declarative operation definitions, OAuth2/bearer/custom token authentication, automatic retry logic, Zod-based param validation, and structured error handling.

## Installation

```bash
npm install @hardlydifficult/rest-client
```

## Quick Start

```typescript
import { RestClient, defineOperation } from "@hardlydifficult/rest-client";
import { z } from "zod";

// Define a REST operation
const GetUser = defineOperation<{ id: string }, User>({
  params: z.object({ id: z.string() }),
  method: "GET",
  url: (p, base) => `${base}/users/${p.id}`,
});

// Create a client with OAuth2 auth
class MyApi extends RestClient {
  getUser = this.bind(GetUser);
}

const api = new MyApi({
  baseUrl: "https://api.example.com",
  auth: {
    type: "oauth2",
    tokenUrl: "https://auth.example.com/token",
    clientId: "client-id",
    clientSecret: "secret",
  },
});

// Make a request
const user = await api.getUser({ id: "123" });
// => User object with id, name, etc.
```

## Core Classes

### RestClient

Opinionated REST client with OAuth2, retries, and declarative operations.

#### Constructor

```typescript
new RestClient(config: RestClientConfig)
```

| Property | Type | Description |
|----------|------|-------------|
| `baseUrl` | `string` | Base URL for all requests (required) |
| `auth` | `AuthConfig?` | Authentication configuration (optional, default: `{ type: "none" }`) |
| `retry` | `RetryConfig?` | Retry settings (optional, default: `{ maxAttempts: 3, delayMs: 6000 }`) |
| `defaultHeaders` | `Record<string, string>?` | Default HTTP headers (optional) |
| `logger` | `RestClientLogger?` | Logger instance (optional) |

#### Methods

```typescript
bind<Params, Response>(
  config: OperationConfig<Params, Response>
): (params: Params) => Promise<Response>
```

Bind a declarative operation to the client.

```typescript
await authenticate(): Promise<string>
```

Authenticate and set the bearer token.

```typescript
clearToken(): void
```

Clear the cached token, forcing re-authentication on next request.

```typescript
getBaseUrl(): string
```

Get the base URL.

```typescript
getLogger(): RestClientLogger | undefined
```

Get the logger instance.

```typescript
await get<T>(url: string): Promise<T>
```

Perform a GET request.

```typescript
await post<T>(url: string, data?: unknown): Promise<T>
```

Perform a POST request.

```typescript
await delete<T>(url: string): Promise<T>
```

Perform a DELETE request.

```typescript
await patch<T>(url: string, data?: unknown): Promise<T>
```

Perform a PATCH request.

```typescript
await put<T>(url: string, data?: unknown): Promise<T>
```

Perform a PUT request.

```typescript
getTokenExpiryTime(): number | null
```

Token expiry timestamp (ms since epoch), or `null` if unavailable.

```typescript
getTokenIssuedAt(): number | null
```

Token issue timestamp (ms since epoch), or `null` if unavailable.

```typescript
getTokenLifetimeMs(): number | null
```

Token lifetime in milliseconds, or `null` if unavailable.

### HttpClient

HTTP client with automatic retries and structured error formatting.

#### Constructor

```typescript
new HttpClient(options?: {
  logger?: RestClientLogger;
  retry?: RetryConfig;
  defaultHeaders?: Record<string, string>;
})
```

#### Methods

```typescript
setBearerToken(token: string): void
```

Set the Authorization header with Bearer token.

```typescript
clearBearerToken(): void
```

Clear the Authorization header.

```typescript
await get<T>(url: string): Promise<T>
```

Perform a GET request.

```typescript
await post<T>(url: string, data?: unknown): Promise<T>
```

Perform a POST request.

```typescript
await delete<T>(url: string): Promise<T>
```

Perform a DELETE request.

```typescript
await patch<T>(url: string, data?: unknown): Promise<T>
```

Perform a PATCH request.

```typescript
await put<T>(url: string, data?: unknown): Promise<T>
```

Perform a PUT request.

#### Retry Behavior

- Automatically retries on 5xx errors and network failures
- Default: 3 attempts with 6000ms delay between retries
- Custom retryable status codes or conditions可通过 `retryableStatuses` and `isRetryable`

### AuthenticationManager

Manages token lifecycle for all supported auth strategies.

#### Constructor

```typescript
new AuthenticationManager(config: AuthConfig, logger?: RestClientLogger)
```

#### Methods

```typescript
await authenticate(): Promise<string>
```

Authenticate and return the bearer token.

```typescript
clearToken(): void
```

Clear cached token and timing info.

```typescript
getTokenExpiryTime(): number | null
```

Token expiry timestamp (ms since epoch), or `null` if unavailable.

```typescript
getTokenIssuedAt(): number | null
```

Token issue timestamp (ms since epoch), or `null` if unavailable.

```typescript
getTokenLifetimeMs(): number | null
```

Token lifetime in milliseconds, or `null` if unavailable.

#### Supported Auth Types

| Type | Config | Description |
|------|--------|-------------|
| `bearer` | `{ type: "bearer", token: string }` | Static bearer token |
| `generator` | `{ type: "generator", generate: () => Promise<string>, cacheDurationMs?: number }` | Async token generator with optional cache |
| `oauth2` | `{ type: "oauth2", tokenUrl: string, clientId: string, clientSecret?: string, audience?: string, scope?: string, grantType?: "client_credentials" \| "password", username?: string, password?: string }` | OAuth2 client credentials or password grant |
| `none` | `{ type: "none" }` | No authentication (default) |

### defineOperation

Define a REST operation declaratively.

```typescript
const GetUser = defineOperation<{ id: string }, User>({
  params: z.object({ id: z.string() }),
  method: "GET",
  url: (p, base) => `${base}/users/${p.id}`,
});
```

#### Config Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `params` | `z.ZodType<Params>` | Yes | Zod schema for request parameters |
| `method` | `HttpMethod` | Yes | HTTP method: `"GET"`, `"POST"`, `"DELETE"`, `"PATCH"`, `"PUT"` |
| `url` | `(params: Params, baseUrl: string) => string` | Yes | URL builder function |
| `body` | `(params: Params) => Record<string, unknown> \| string \| undefined` | No | Optional body builder |
| `transform` | `(response: Response) => Response` | No | Optional response transformer |

### validateParams

Validate params against a Zod schema, throwing `ValidationError` on failure.

```typescript
validateParams<T>(params: T, schema: z.ZodType<T>): T
```

```typescript
const validated = validateParams({ id: "123" }, z.object({ id: z.string() }));
// => { id: "123" }
```

## Error Handling

All errors extend `RestClientError` and include a `code` and optional `context`.

| Error Type | Code | Description |
|------------|------|-------------|
| `ConfigurationError` | `"CONFIGURATION_ERROR"` | Invalid client configuration (e.g., missing `baseUrl`) |
| `AuthenticationError` | `"AUTHENTICATION_ERROR"` | Authentication failure |
| `HttpError` | `"HTTP_ERROR"` | HTTP error with status, statusText, and response data |
| `ValidationError` | `"VALIDATION_ERROR"` | Parameter validation failure (via Zod) |
| `NetworkError` | `"NETWORK_ERROR"` | Network-level errors (e.g., DNS failure, connection refused) |

Example:

```typescript
try {
  await api.getUser({ id: "123" });
} catch (error) {
  if (error instanceof HttpError) {
    console.log(error.status, error.message);
  }
}
```

## Types

### AuthConfig

Union type of auth configurations: `OAuth2Auth | BearerAuth | TokenGeneratorAuth | NoAuth`

### RetryConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxAttempts` | `number` | `3` | Number of retries after the initial attempt |
| `delayMs` | `number` | `6000` | Delay between retries in milliseconds |
| `retryableStatuses` | `readonly number[]?` | `undefined` | Additional HTTP status codes to retry on |
| `isRetryable` | `(status: number, body: Record<string, unknown>) => boolean?` | `undefined` | Custom retryable check |

### RestClientLogger

Minimal logger interface (compatible with `@hardlydifficult/logger`):

```typescript
interface RestClientLogger {
  debug?(message: string, context?: Record<string, unknown>): void;
  info?(message: string, context?: Record<string, unknown>): void;
  warn?(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}
```

All methods are optional — only implement what you need.

## Appendix

### Retryable Status Codes

By default, the client retries on:

- All 5xx status codes (500–599)
- Network errors (no response)
- Custom status codes via `retryableStatuses`
- Custom conditions via `isRetryable`

OAuth2 token refresh is automatically triggered when the token is near expiry (half its lifetime or 5 minutes, whichever is smaller).