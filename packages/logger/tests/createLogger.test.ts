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

  it("can suppress the default console logger", () => {
    const filePath = join(tempDir, "logs", "app.jsonl");
    const logger = createLogger({
      suppressConsole: true,
      filePath,
    });

    logger.info("server started");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(existsSync(filePath)).toBe(true);
  });

  it("binds the logger name into every entry", () => {
    const logger = createLogger({ name: "api" });
    const plugin = createSpyPlugin();
    logger.use(plugin);

    logger.info("request complete");

    const entry: LogEntry = plugin.log.mock.calls[0][0];
    expect(entry.context).toEqual({ name: "api" });
  });

  it("mirrors entries to a JSONL file when filePath is provided", () => {
    const filePath = join(tempDir, "logs", "app.jsonl");
    const logger = createLogger({ filePath });

    logger.warn("disk nearly full", { freePercent: 8 });

    expect(existsSync(filePath)).toBe(true);
    const entry = JSON.parse(readFileSync(filePath, "utf-8").trim()) as LogEntry;
    expect(entry.level).toBe("warn");
    expect(entry.context).toEqual({ freePercent: 8 });
  });

  it("sends warn and error entries to Discord when configured", () => {
    const sender = vi.fn();
    const logger = createLogger({ discord: sender });

    logger.info("ignored");
    logger.error("database unavailable");

    expect(sender).toHaveBeenCalledOnce();
    expect(sender.mock.calls[0]![0]).toContain("**ERROR**: database unavailable");
  });
});
