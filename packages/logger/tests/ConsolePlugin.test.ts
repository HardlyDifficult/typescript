import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsolePlugin, formatEntry } from "../src/plugins/ConsolePlugin.js";
import type { LogEntry } from "../src/types.js";

describe("formatEntry", () => {
  it("formats a basic entry without context", () => {
    const entry: LogEntry = {
      level: "info",
      message: "hello world",
      timestamp: "2025-01-15T10:30:00.000Z",
    };
    expect(formatEntry(entry)).toBe(
      "[2025-01-15T10:30:00.000Z] INFO: hello world"
    );
  });

  it("formats an entry with context", () => {
    const entry: LogEntry = {
      level: "error",
      message: "something broke",
      timestamp: "2025-01-15T10:30:00.000Z",
      context: { code: 500, detail: "timeout" },
    };
    const result = formatEntry(entry);
    expect(result).toBe(
      '[2025-01-15T10:30:00.000Z] ERROR: something broke {"code":500,"detail":"timeout"}'
    );
  });

  it("omits context when it is an empty object", () => {
    const entry: LogEntry = {
      level: "warn",
      message: "empty ctx",
      timestamp: "2025-01-15T10:30:00.000Z",
      context: {},
    };
    expect(formatEntry(entry)).toBe(
      "[2025-01-15T10:30:00.000Z] WARN: empty ctx"
    );
  });

  it("uppercases the level", () => {
    const entry: LogEntry = {
      level: "debug",
      message: "test",
      timestamp: "2025-01-15T10:30:00.000Z",
    };
    expect(formatEntry(entry)).toContain("DEBUG:");
  });

  it("safely formats non-JSON-native values", () => {
    const error = new Error("boom");
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    const entry: LogEntry = {
      level: "error",
      message: "serialization test",
      timestamp: "2025-01-15T10:30:00.000Z",
      context: {
        error,
        attempts: 3n,
        circular,
      },
    };

    const result = formatEntry(entry);
    expect(result).toContain('"message":"boom"');
    expect(result).toContain('"attempts":"3"');
    expect(result).toContain('"self":"[Circular]"');
  });
});

describe("ConsolePlugin", () => {
  let plugin: ConsolePlugin;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    plugin = new ConsolePlugin();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses console.log for debug level", () => {
    const entry: LogEntry = {
      level: "debug",
      message: "dbg",
      timestamp: "2025-01-15T10:30:00.000Z",
    };
    plugin.log(entry);
    expect(logSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("uses console.log for info level", () => {
    const entry: LogEntry = {
      level: "info",
      message: "inf",
      timestamp: "2025-01-15T10:30:00.000Z",
    };
    plugin.log(entry);
    expect(logSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("uses console.warn for warn level", () => {
    const entry: LogEntry = {
      level: "warn",
      message: "wrn",
      timestamp: "2025-01-15T10:30:00.000Z",
    };
    plugin.log(entry);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("uses console.error for error level", () => {
    const entry: LogEntry = {
      level: "error",
      message: "err",
      timestamp: "2025-01-15T10:30:00.000Z",
    };
    plugin.log(entry);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("passes the formatted string to the console method", () => {
    const entry: LogEntry = {
      level: "info",
      message: "formatted test",
      timestamp: "2025-01-15T10:30:00.000Z",
      context: { a: 1 },
    };
    plugin.log(entry);
    expect(logSpy).toHaveBeenCalledWith(
      '[2025-01-15T10:30:00.000Z] INFO: formatted test {"a":1}'
    );
  });

  it("uses console.warn for unknown levels (default branch)", () => {
    const entry = {
      level: "unknown" as LogEntry["level"],
      message: "unknown level",
      timestamp: "2025-01-15T10:30:00.000Z",
    };
    plugin.log(entry);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
