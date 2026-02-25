export { RestClient } from "./RestClient.js";
export { defineOperation, validateParams } from "./Operation.js";
export type { OperationConfig } from "./Operation.js";
export { AuthenticationManager } from "./AuthenticationManager.js";
export { HttpClient } from "./HttpClient.js";

export {
  RestClientError,
  ConfigurationError,
  AuthenticationError,
  HttpError,
  ValidationError,
  NetworkError,
  ErrorCode,
} from "./errors.js";
export type { ErrorContext, ErrorCodeType } from "./errors.js";

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
} from "./types.js";
