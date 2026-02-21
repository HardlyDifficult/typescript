import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { SessionTracker } from "../src/SessionTracker.js";
import type { SessionEntry } from "../src/types.js";

describe("SessionTracker", () => {
  let tempDir: string;
  let tracker: SessionTracker;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "session-tracker-test-"));
    tracker = new SessionTracker({ stateDirectory: tempDir });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("append", () => {
    it("creates a JSONL file on first append", () => {
      tracker.append("sess-1", {
        type: "session_start",
        data: { prompt: "hello" },
      });

      const fp = join(tempDir, "sessions", "sess-1.jsonl");
      expect(existsSync(fp)).toBe(true);
    });

    it("appends multiple entries to the same file", () => {
      tracker.append("sess-1", {
        type: "session_start",
        data: { prompt: "hello" },
      });
      tracker.append("sess-1", {
        type: "ai_response",
        data: { response: "world" },
      });

      const fp = join(tempDir, "sessions", "sess-1.jsonl");
      const lines = readFileSync(fp, "utf-8")
        .split("\n")
        .filter((l) => l.length > 0);
      expect(lines).toHaveLength(2);
    });

    it("writes valid JSON per line with timestamp", () => {
      tracker.append("sess-1", {
        type: "tool_call",
        data: { name: "Read", input: { path: "/foo" } },
      });

      const fp = join(tempDir, "sessions", "sess-1.jsonl");
      const content = readFileSync(fp, "utf-8").trim();
      const parsed = JSON.parse(content) as SessionEntry;
      expect(parsed.type).toBe("tool_call");
      expect(parsed.data.name).toBe("Read");
      expect(parsed.timestamp).toBeDefined();
      // Timestamp should be ISO 8601
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });

    it("uses custom subdirectory when configured", () => {
      const custom = new SessionTracker({
        stateDirectory: tempDir,
        subdirectory: "debug-logs",
      });
      custom.append("sess-2", {
        type: "session_start",
        data: {},
      });

      expect(existsSync(join(tempDir, "debug-logs", "sess-2.jsonl"))).toBe(
        true,
      );
    });

    it("swallows write errors", () => {
      const badTracker = new SessionTracker({
        stateDirectory: "/nonexistent/path/that/will/fail",
      });
      expect(() =>
        badTracker.append("x", { type: "error", data: {} }),
      ).not.toThrow();
    });
  });

  describe("read", () => {
    it("returns entries for an existing session", () => {
      tracker.append("sess-1", {
        type: "session_start",
        data: { prompt: "hello" },
      });
      tracker.append("sess-1", {
        type: "ai_response",
        data: { response: "hi" },
      });

      const entries = tracker.read("sess-1");
      expect(entries).toHaveLength(2);
      expect(entries[0].type).toBe("session_start");
      expect(entries[0].data.prompt).toBe("hello");
      expect(entries[1].type).toBe("ai_response");
      expect(entries[1].data.response).toBe("hi");
    });

    it("returns empty array for nonexistent session", () => {
      expect(tracker.read("nonexistent")).toEqual([]);
    });
  });

  describe("list", () => {
    it("returns empty array when no sessions exist", () => {
      expect(tracker.list()).toEqual([]);
    });

    it("lists sessions with metadata", () => {
      tracker.append("sess-a", {
        type: "session_start",
        data: { prompt: "first" },
      });
      tracker.append("sess-b", {
        type: "session_start",
        data: { prompt: "second" },
      });
      tracker.append("sess-b", {
        type: "session_end",
        data: { success: true },
      });

      const sessions = tracker.list();
      expect(sessions).toHaveLength(2);

      // Should be sorted by lastModifiedAt descending
      const ids = sessions.map((s) => s.sessionId);
      expect(ids).toContain("sess-a");
      expect(ids).toContain("sess-b");

      // sess-b should have 2 entries
      const sessB = sessions.find((s) => s.sessionId === "sess-b")!;
      expect(sessB.entryCount).toBe(2);
      expect(sessB.sizeBytes).toBeGreaterThan(0);
      expect(sessB.startedAt).toBeDefined();
      expect(sessB.lastModifiedAt).toBeDefined();
    });
  });

  describe("has", () => {
    it("returns true for existing session", () => {
      tracker.append("sess-1", {
        type: "session_start",
        data: {},
      });
      expect(tracker.has("sess-1")).toBe(true);
    });

    it("returns false for nonexistent session", () => {
      expect(tracker.has("nonexistent")).toBe(false);
    });
  });

  describe("delete", () => {
    it("deletes an existing session and returns true", () => {
      tracker.append("sess-1", {
        type: "session_start",
        data: {},
      });
      expect(tracker.delete("sess-1")).toBe(true);
      expect(tracker.has("sess-1")).toBe(false);
    });

    it("returns false for nonexistent session", () => {
      expect(tracker.delete("nonexistent")).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("deletes files older than maxAgeMs", async () => {
      // Create tracker with very short max age
      const aggressiveTracker = new SessionTracker({
        stateDirectory: tempDir,
        maxAgeMs: 1,
      });

      aggressiveTracker.append("old-session", {
        type: "session_start",
        data: {},
      });

      // Wait so file mtime is clearly in the past
      await new Promise((r) => setTimeout(r, 20));

      const deleted = aggressiveTracker.cleanup();
      expect(deleted).toBe(1);
      expect(aggressiveTracker.has("old-session")).toBe(false);
    });

    it("keeps recent files", () => {
      tracker.append("recent-session", {
        type: "session_start",
        data: {},
      });

      const deleted = tracker.cleanup();
      expect(deleted).toBe(0);
      expect(tracker.has("recent-session")).toBe(true);
    });

    it("returns 0 when directory is empty", () => {
      expect(tracker.cleanup()).toBe(0);
    });
  });
});
