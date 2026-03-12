/**
 * Tests for SessionTracker error-swallowing catch paths that require
 * mocking the node:fs module (ESM module mocking).
 */
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, vi, afterEach } from "vitest";

// We need vi.mock hoisted to the top of the file before any imports
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
    unlinkSync: vi.fn(actual.unlinkSync),
    statSync: vi.fn(actual.statSync),
  };
});

import { SessionTracker } from "../src/SessionTracker.js";
import * as fsMocked from "node:fs";

// Capture original implementations for restoring in individual tests
// These are captured after mock is set up but they call through to actual
const origReadFileSync = fsMocked.readFileSync;
const origUnlinkSync = fsMocked.unlinkSync;
const origStatSync = fsMocked.statSync;

describe("SessionTracker fs-error paths (mocked)", () => {
  afterEach(() => {
    vi.mocked(fsMocked.readFileSync).mockImplementation(origReadFileSync as never);
    vi.mocked(fsMocked.unlinkSync).mockImplementation(origUnlinkSync as never);
    vi.mocked(fsMocked.statSync).mockImplementation(origStatSync as never);
  });

  it("read() returns empty array when readFileSync throws after existsSync returns true", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "session-tracker-err-"));
    try {
      const tracker = new SessionTracker({ stateDirectory: tempDir });
      // Write a session file directly (uses appendFileSync which passes through)
      const sessDir = join(tempDir, "sessions");
      appendFileSync(join(sessDir, "err-sess.jsonl"), "");

      // Make readFileSync throw
      vi.mocked(fsMocked.readFileSync).mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      const result = tracker.read("err-sess");
      expect(result).toEqual([]);
    } finally {
      vi.mocked(fsMocked.readFileSync).mockImplementation(origReadFileSync as never);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("delete() returns false when unlinkSync throws", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "session-tracker-del-"));
    try {
      const tracker = new SessionTracker({ stateDirectory: tempDir });
      const sessDir = join(tempDir, "sessions");
      appendFileSync(join(sessDir, "del-err.jsonl"), "");

      // Make unlinkSync throw
      vi.mocked(fsMocked.unlinkSync).mockImplementation(() => {
        throw new Error("EPERM: operation not permitted");
      });

      const result = tracker.delete("del-err");
      expect(result).toBe(false);
    } finally {
      vi.mocked(fsMocked.unlinkSync).mockImplementation(origUnlinkSync as never);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("list() skips files where statSync throws (per-file catch)", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "session-tracker-list-"));
    try {
      const tracker = new SessionTracker({ stateDirectory: tempDir });
      const sessDir = join(tempDir, "sessions");
      appendFileSync(join(sessDir, "good-sess.jsonl"), "");
      appendFileSync(join(sessDir, "bad-sess.jsonl"), "");

      vi.mocked(fsMocked.statSync).mockImplementation(
        (...args: Parameters<typeof fsMocked.statSync>) => {
          const p = String(args[0]);
          if (p.includes("bad-sess")) {
            throw new Error("EACCES: permission denied");
          }
          // @ts-expect-error spread args
          return origStatSync(...args);
        }
      );

      const sessions = tracker.list();
      expect(sessions.some((s) => s.sessionId === "good-sess")).toBe(true);
      expect(sessions.some((s) => s.sessionId === "bad-sess")).toBe(false);
    } finally {
      vi.mocked(fsMocked.statSync).mockImplementation(origStatSync as never);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
