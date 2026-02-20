import { describe, it, expect } from "vitest";
import {
  RestClientError,
  ConfigurationError,
  AuthenticationError,
  HttpError,
  ValidationError,
  NetworkError,
  ErrorCode,
} from "../src/errors";

describe("Error hierarchy", () => {
  it("RestClientError has code and context", () => {
    const err = new RestClientError("test", "TEST_CODE", { key: "value" });
    expect(err.message).toBe("test");
    expect(err.code).toBe("TEST_CODE");
    expect(err.context).toEqual({ key: "value" });
    expect(err.name).toBe("RestClientError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RestClientError);
  });

  it("ConfigurationError extends RestClientError", () => {
    const err = new ConfigurationError("missing baseUrl");
    expect(err).toBeInstanceOf(RestClientError);
    expect(err.name).toBe("ConfigurationError");
    expect(err.code).toBe(ErrorCode.CONFIGURATION_ERROR);
  });

  it("AuthenticationError extends RestClientError", () => {
    const err = new AuthenticationError("bad creds");
    expect(err).toBeInstanceOf(RestClientError);
    expect(err.name).toBe("AuthenticationError");
    expect(err.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
  });

  it("HttpError includes status and statusText", () => {
    const err = new HttpError("not found", 404, "Not Found", {
      detail: "missing",
    });
    expect(err).toBeInstanceOf(RestClientError);
    expect(err.name).toBe("HttpError");
    expect(err.code).toBe(ErrorCode.HTTP_ERROR);
    expect(err.status).toBe(404);
    expect(err.statusText).toBe("Not Found");
    expect(err.context).toEqual({ detail: "missing" });
  });

  it("ValidationError extends RestClientError", () => {
    const err = new ValidationError("bad params");
    expect(err).toBeInstanceOf(RestClientError);
    expect(err.name).toBe("ValidationError");
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("NetworkError extends RestClientError", () => {
    const err = new NetworkError("ECONNREFUSED");
    expect(err).toBeInstanceOf(RestClientError);
    expect(err.name).toBe("NetworkError");
    expect(err.code).toBe(ErrorCode.NETWORK_ERROR);
  });

  it("prototype chain survives subclass instanceof checks", () => {
    const err = new HttpError("test", 500);
    expect(err instanceof HttpError).toBe(true);
    expect(err instanceof RestClientError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});
