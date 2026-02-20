export { RestClient } from "./RestClient";
export { defineOperation, validateParams } from "./Operation";
export type { OperationConfig } from "./Operation";
export { AuthenticationManager } from "./AuthenticationManager";
export { HttpClient } from "./HttpClient";

export {
  RestClientError,
  ConfigurationError,
  AuthenticationError,
  HttpError,
  ValidationError,
  NetworkError,
  ErrorCode,
} from "./errors";
export type { ErrorContext, ErrorCodeType } from "./errors";

export type {
  RestClientConfig,
  AuthConfig,
  OAuth2Auth,
  BearerAuth,
  TokenGeneratorAuth,
  NoAuth,
  RetryConfig,
  RestClientLogger,
  HttpMethod,
} from "./types";
