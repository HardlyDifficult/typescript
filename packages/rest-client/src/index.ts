export { RestClient, createRestClient } from "./RestClient.js";
export { defineOperation, operation, validateParams } from "./Operation.js";
export type {
  BoundOperation,
  OperationConfig,
  OperationOptions,
} from "./Operation.js";
export type {
  AnyOperationConfig,
  BoundOperations,
  OperationMap,
  RestClientApi,
} from "./RestClient.js";
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
