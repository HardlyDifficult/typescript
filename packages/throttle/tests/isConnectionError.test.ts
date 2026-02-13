import { describe, it, expect } from "vitest";
import { isConnectionError } from "../src/isConnectionError";

describe("isConnectionError", () => {
  it("should return true for Error with ECONNREFUSED message", () => {
    const error = new Error("connect ECONNREFUSED 127.0.0.1:11434");
    expect(isConnectionError(error)).toBe(true);
  });

  it("should return true for Error with 'cannot connect to api' message", () => {
    const error = new Error("Cannot connect to API at localhost");
    expect(isConnectionError(error)).toBe(true);
  });

  it("should return true for nested error via cause", () => {
    const inner = new Error("connect ECONNREFUSED 127.0.0.1:11434");
    const outer = new Error("Request failed");
    (outer as unknown as Record<string, unknown>)["cause"] = inner;
    expect(isConnectionError(outer)).toBe(true);
  });

  it("should return true for nested error via lastError", () => {
    const inner = new Error("connect ECONNREFUSED 127.0.0.1:11434");
    const outer = new Error("Retry failed after 3 attempts");
    (outer as unknown as Record<string, unknown>)["lastError"] = inner;
    expect(isConnectionError(outer)).toBe(true);
  });

  it("should return true for nested error via errors array", () => {
    const inner = new Error("connect ECONNREFUSED 127.0.0.1:11434");
    const outer = new Error("Multiple errors occurred");
    (outer as unknown as Record<string, unknown>)["errors"] = [
      new Error("some other error"),
      inner,
    ];
    expect(isConnectionError(outer)).toBe(true);
  });

  it("should return true for error with code ECONNREFUSED", () => {
    const error = new Error("Something went wrong");
    (error as unknown as Record<string, unknown>)["code"] = "ECONNREFUSED";
    expect(isConnectionError(error)).toBe(true);
  });

  it("should return false for non-connection errors", () => {
    expect(isConnectionError(new Error("File not found"))).toBe(false);
    expect(isConnectionError(new Error("Timeout"))).toBe(false);
    expect(isConnectionError(new Error("Permission denied"))).toBe(false);
  });

  it("should return false for non-Error values", () => {
    expect(isConnectionError("ECONNREFUSED")).toBe(false);
    expect(isConnectionError(null)).toBe(false);
    expect(isConnectionError(undefined)).toBe(false);
    expect(isConnectionError(42)).toBe(false);
    expect(isConnectionError({ message: "ECONNREFUSED" })).toBe(false);
  });
});
