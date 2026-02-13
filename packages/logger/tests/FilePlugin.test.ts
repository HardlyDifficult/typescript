import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FilePlugin } from "../src/plugins/FilePlugin.js";
import type { LogEntry } from "../src/types.js";

function makeEntry(
  level: LogEntry["level"],
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  return {
    level,
    message,
    timestamp: "2025-01-15T10:30:00.000Z",
    ...(context !== undefined ? { context } : {}),
  };
}

describe("FilePlugin", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "logger-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates directory if it does not exist", () => {
    const nestedPath = join(tempDir, "sub", "dir", "log.jsonl");
    new FilePlugin(nestedPath);
    expect(existsSync(join(tempDir, "sub", "dir"))).toBe(true);
  });

  it("appends JSONL to file", () => {
    const filePath = join(tempDir, "test.jsonl");
    const plugin = new FilePlugin(filePath);

    plugin.log(makeEntry("info", "first"));
    plugin.log(makeEntry("warn", "second"));

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("each entry is one line of valid JSON", () => {
    const filePath = join(tempDir, "test.jsonl");
    const plugin = new FilePlugin(filePath);

    const entry = makeEntry("error", "test entry", { key: "value" });
    plugin.log(entry);

    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("test entry");
    expect(parsed.timestamp).toBe("2025-01-15T10:30:00.000Z");
    expect(parsed.context).toEqual({ key: "value" });
  });

  it("writes entries without context correctly", () => {
    const filePath = join(tempDir, "test.jsonl");
    const plugin = new FilePlugin(filePath);

    plugin.log(makeEntry("info", "no context"));

    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content.trim());
    expect(parsed.context).toBeUndefined();
  });

  it("swallows write errors", () => {
    const filePath = join(tempDir, "test.jsonl");
    const plugin = new FilePlugin(filePath);

    // Make the file path invalid after construction by removing the directory
    rmSync(tempDir, { recursive: true, force: true });

    expect(() =>
      plugin.log(makeEntry("info", "should not throw"))
    ).not.toThrow();
  });
});
