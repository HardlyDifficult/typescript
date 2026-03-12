import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { LogEntry, LoggerPlugin } from "../src/types.js";
import { createLogger } from "../src/createLogger.js";

function createSpyPlugin(): LoggerPlugin & {
  log: ReturnType<typeof vi.fn>;
} {
  return {
    log: vi.fn(),
  };
}

describe("createLogger", () => {
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "create-logger-test-"));
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes to console by default", () => {
    const logger = createLogger();
    logger.info("server started");

    expect(logSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("can disable console output while still writing to a file", () => {
    const filePath = join(tempDir, "logs", "app.jsonl");
    const logger = createLogger({
      console: false,
      file: filePath,
    });

    logger.info("server started");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(existsSync(filePath)).toBe(true);
  });

  it("binds scope from the string shorthand", () => {
    const logger = createLogger("api");
    const plugin = createSpyPlugin();
    logger.use(plugin);

    logger.info("request complete");

    const entry: LogEntry = plugin.log.mock.calls[0][0];
    expect(entry.context).toEqual({ scope: "api" });
  });

  it("merges additional context with the scope shorthand", () => {
    const logger = createLogger("api", {
      context: { region: "us-east-1" },
    });
    const plugin = createSpyPlugin();
    logger.use(plugin);

    logger.info("request complete");

    const entry: LogEntry = plugin.log.mock.calls[0][0];
    expect(entry.context).toEqual({
      region: "us-east-1",
      scope: "api",
    });
  });

  it("mirrors entries to a JSONL file when file is provided", () => {
    const filePath = join(tempDir, "logs", "app.jsonl");
    const logger = createLogger({ file: filePath });

    logger.warn("disk nearly full", { freePercent: 8 });

    expect(existsSync(filePath)).toBe(true);
    const entry = JSON.parse(
      readFileSync(filePath, "utf-8").trim()
    ) as LogEntry;
    expect(entry.level).toBe("warn");
    expect(entry.context).toEqual({ freePercent: 8 });
  });

  it("supports context without scope (exercises the context ?? {} branch)", () => {
    const logger = createLogger({ context: { region: "us-east-1" }, console: false });
    const plugin = createSpyPlugin();
    logger.use(plugin);

    logger.info("region test");

    const entry: LogEntry = plugin.log.mock.calls[0][0];
    expect(entry.context).toEqual({ region: "us-east-1" });
  });

  it("sends warn and error entries to the configured alert sender", () => {
    const sender = vi.fn();
    const logger = createLogger({ alert: sender });

    logger.info("ignored");
    logger.error("database unavailable");

    expect(sender).toHaveBeenCalledOnce();
    expect(sender.mock.calls[0]![0]).toContain(
      "**ERROR**: database unavailable"
    );
  });
});
