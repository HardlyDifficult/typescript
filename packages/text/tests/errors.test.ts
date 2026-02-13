import { describe, it, expect } from "vitest";
import { getErrorMessage, formatError, formatErrorForLog } from "../src/errors.js";

describe("getErrorMessage", () => {
  it("extracts message from Error instance", () => {
    const err = new Error("something went wrong");
    expect(getErrorMessage(err)).toBe("something went wrong");
  });

  it("converts string to message", () => {
    expect(getErrorMessage("plain string error")).toBe("plain string error");
  });

  it("converts number to message", () => {
    expect(getErrorMessage(42)).toBe("42");
  });

  it("converts undefined to message", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });
});

describe("formatError", () => {
  it("formats error without context", () => {
    const err = new Error("disk full");
    expect(formatError(err)).toBe("disk full");
  });

  it("formats error with context", () => {
    const err = new Error("disk full");
    expect(formatError(err, "Failed to save")).toBe("Failed to save: disk full");
  });
});

describe("formatErrorForLog", () => {
  it("returns message for Error instance", () => {
    const err = new Error("timeout");
    expect(formatErrorForLog(err)).toBe("timeout");
  });

  it("converts non-Error to string", () => {
    expect(formatErrorForLog({ code: 500 })).toBe("[object Object]");
  });
});
