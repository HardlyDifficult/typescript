/**
 * Tests for SessionTracker error-swallowing catch paths that require
 * mocking the node:fs module (ESM module mocking).
 */
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, vi, afterEach } from "vitest";

// vi.hoisted runs before imports and before vi.mock factories
const { actuals } = vi.hoisted(() => {
  const actuals: {
    readFileSync?: typeof import("node:fs").readFileSync;
    unlinkSync?: typeof import("node:fs").unlinkSync;
    statSync?: typeof import("node:fs").statSync;
    readdirSync?: typeof import("node:fs").readdirSync;
  } = {};
  return { actuals };
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  actuals.readFileSync = actual.readFileSync;
  actuals.unlinkSync = actual.unlinkSync;
  actuals.statSync = actual.statSync;
  actuals.readdirSync = actual.readdirSync;
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
    unlinkSync: vi.fn(actual.unlinkSync),
    statSync: vi.fn(actual.statSync),
    readdirSync: vi.fn(actual.readdirSync),
  };
});

import { SessionTracker } from "../src/SessionTracker.js";
import * as fsMocked from "node:fs";

describe("SessionTracker fs-error paths (mocked)", () => {
  afterEach(() => {
    // Restore implementations to passthrough after each test
    if (actuals.readFileSync !== undefined) {
      vi.mocked(fsMocked.readFileSync).mockImplementation(
        actuals.readFileSync as never
      );
    }
    if (actuals.unlinkSync !== undefined) {
      vi.mocked(fsMocked.unlinkSync).mockImplementation(
        actuals.unlinkSync as never
      );
    }
    if (actuals.statSync !== undefined) {
      vi.mocked(fsMocked.statSync).mockImplementation(
        actuals.statSync as never
      );
    }
    if (actuals.readdirSync !== undefined) {
      vi.mocked(fsMocked.readdirSync).mockImplementation(
        actuals.readdirSync as never
      );
    }
  });

  it("read() returns empty array when readFileSync throws after existsSync returns true", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "session-tracker-err-"));
    try {
      const tracker = new SessionTracker({ stateDirectory: tempDir });
      // Write a session file directly
      const sessDir = join(tempDir, "sessions");
      appendFileSync(join(sessDir, "err-sess.jsonl"), "");

      // Make readFileSync throw
      vi.mocked(fsMocked.readFileSync).mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      const result = tracker.read("err-sess");
      expect(result).toEqual([]);
    } finally {
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

      const actualStat = actuals.statSync!;
      vi.mocked(fsMocked.statSync).mockImplementation(
        (...args: Parameters<typeof fsMocked.statSync>) => {
          const p = String(args[0]);
          if (p.includes("bad-sess")) {
            throw new Error("EACCES: permission denied");
          }
          // @ts-expect-error spread args
          return actualStat(...args);
        }
      );

      const sessions = tracker.list();
      expect(sessions.some((s) => s.sessionId === "good-sess")).toBe(true);
      expect(sessions.some((s) => s.sessionId === "bad-sess")).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("list() returns empty array when readdirSync throws (outer catch)", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "session-tracker-rdir-"));
    try {
      const tracker = new SessionTracker({ stateDirectory: tempDir });
      // Create the sessions directory so existsSync passes
      appendFileSync(join(tempDir, "sessions", "any.jsonl"), "");

      // Make readdirSync throw
      vi.mocked(fsMocked.readdirSync).mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      const result = tracker.list();
      expect(result).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
