/** JSON-serializable context for error details. */
export type ErrorContext = Readonly<Record<string, unknown>>;

export const ErrorCode = {
  REST_CLIENT_ERROR: "REST_CLIENT_ERROR",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  HTTP_ERROR: "HTTP_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Base error for all rest-client errors. */
export class RestClientError extends Error {
  public override readonly name: string;

  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: ErrorContext
  ) {
    super(message);
    this.name = "RestClientError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 *
 */
export class ConfigurationError extends RestClientError {
  public override readonly name = "ConfigurationError";

  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCode.CONFIGURATION_ERROR, context);
  }
}

/**
 *
 */
export class AuthenticationError extends RestClientError {
  public override readonly name = "AuthenticationError";

  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCode.AUTHENTICATION_ERROR, context);
  }
}

/**
 *
 */
export class HttpError extends RestClientError {
  public override readonly name = "HttpError";

  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string,
    response?: ErrorContext
  ) {
    super(message, ErrorCode.HTTP_ERROR, response);
  }
}

/**
 *
 */
export class ValidationError extends RestClientError {
  public override readonly name = "ValidationError";

  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCode.VALIDATION_ERROR, context);
  }
}

/**
 *
 */
export class NetworkError extends RestClientError {
  public override readonly name = "NetworkError";

  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCode.NETWORK_ERROR, context);
  }
}
