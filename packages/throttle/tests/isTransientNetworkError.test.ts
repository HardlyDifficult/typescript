import { describe, it, expect } from "vitest";
import { isTransientNetworkError } from "../src/isTransientNetworkError";

describe("isTransientNetworkError", () => {
  it("should detect 'Recv failure: Connection was reset'", () => {
    const error = new Error(
      "fatal: unable to access 'https://github.com/foo/bar.git/': Recv failure: Connection was reset"
    );
    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("should detect ECONNRESET", () => {
    expect(isTransientNetworkError(new Error("read ECONNRESET"))).toBe(true);
  });

  it("should detect ETIMEDOUT", () => {
    expect(isTransientNetworkError(new Error("connect ETIMEDOUT 1.2.3.4:443"))).toBe(true);
  });

  it("should detect 'unable to access'", () => {
    expect(
      isTransientNetworkError(new Error("unable to access 'https://github.com/foo/bar.git/'"))
    ).toBe(true);
  });

  it("should detect DNS resolution failures", () => {
    expect(
      isTransientNetworkError(new Error("Could not resolve host: github.com"))
    ).toBe(true);
  });

  it("should detect TLS termination errors", () => {
    expect(
      isTransientNetworkError(new Error("TLS connection was non-properly terminated"))
    ).toBe(true);
  });

  it("should detect 'the remote end hung up unexpectedly'", () => {
    expect(
      isTransientNetworkError(new Error("the remote end hung up unexpectedly"))
    ).toBe(true);
  });

  it("should return false for non-network errors", () => {
    expect(isTransientNetworkError(new Error("File not found"))).toBe(false);
    expect(isTransientNetworkError(new Error("Permission denied"))).toBe(false);
    expect(isTransientNetworkError(new Error("ECONNREFUSED"))).toBe(false);
  });

  it("should handle non-Error values", () => {
    expect(isTransientNetworkError("Recv failure: Connection was reset")).toBe(true);
    expect(isTransientNetworkError(42)).toBe(false);
    expect(isTransientNetworkError(null)).toBe(false);
  });
});
