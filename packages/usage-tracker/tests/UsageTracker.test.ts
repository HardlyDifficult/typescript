import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UsageTracker } from "../src/UsageTracker.js";

const defaults = {
  api: { requests: 0, tokens: 0, costUsd: 0 },
  audio: { requests: 0, durationSeconds: 0 },
};

let testDir: string;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "usage-tracker-test-"));
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("UsageTracker", () => {
  describe("create", () => {
    it("starts with zero session and cumulative", async () => {
      const tracker = await UsageTracker.create({
        key: "test",
        default: defaults,
        stateDirectory: testDir,
      });

      expect(tracker.session).toEqual(defaults);
      expect(tracker.cumulative).toEqual(defaults);
    });

    it("sets sessionStartedAt and trackingSince", async () => {
      const before = new Date().toISOString();
      const tracker = await UsageTracker.create({
        key: "test",
        default: defaults,
        stateDirectory: testDir,
      });
      const after = new Date().toISOString();

      expect(tracker.sessionStartedAt >= before).toBe(true);
      expect(tracker.sessionStartedAt <= after).toBe(true);
      expect(tracker.trackingSince >= before).toBe(true);
      expect(tracker.trackingSince <= after).toBe(true);
    });

    it("reports isPersistent true when storage works", async () => {
      const tracker = await UsageTracker.create({
        key: "test",
        default: defaults,
        stateDirectory: testDir,
      });

      expect(tracker.isPersistent).toBe(true);
    });
  });

  describe("record", () => {
    it("increments session and cumulative simultaneously", async () => {
      const tracker = await UsageTracker.create({
        key: "test",
        default: defaults,
        stateDirectory: testDir,
      });

      tracker.record({ api: { requests: 1, tokens: 500, costUsd: 0.01 } });

      expect(tracker.session.api).toEqual({
        requests: 1,
        tokens: 500,
        costUsd: 0.01,
      });
      expect(tracker.cumulative.api).toEqual({
        requests: 1,
        tokens: 500,
        costUsd: 0.01,
      });
      // Audio untouched
      expect(tracker.session.audio).toEqual(defaults.audio);
    });

    it("accepts partial metrics", async () => {
      const tracker = await UsageTracker.create({
        key: "test",
        default: defaults,
        stateDirectory: testDir,
      });

      tracker.record({ api: { requests: 1 } });

      expect(tracker.session.api.requests).toBe(1);
      expect(tracker.session.api.tokens).toBe(0);
      expect(tracker.session.api.costUsd).toBe(0);
    });

    it("accumulates across multiple calls", async () => {
      const tracker = await UsageTracker.create({
        key: "test",
        default: defaults,
        stateDirectory: testDir,
      });

      tracker.record({ api: { requests: 1, tokens: 100 } });
      tracker.record({ api: { requests: 1, tokens: 200 } });
      tracker.record({ audio: { requests: 1, durationSeconds: 30 } });

      expect(tracker.session.api.requests).toBe(2);
      expect(tracker.session.api.tokens).toBe(300);
      expect(tracker.session.audio.requests).toBe(1);
      expect(tracker.session.audio.durationSeconds).toBe(30);
    });
  });

  describe("persistence", () => {
    it("preserves cumulative data across instances", async () => {
      const tracker1 = await UsageTracker.create({
        key: "persist-test",
        default: defaults,
        stateDirectory: testDir,
      });

      tracker1.record({ api: { requests: 5, tokens: 1000, costUsd: 0.05 } });
      await tracker1.save();

      const tracker2 = await UsageTracker.create({
        key: "persist-test",
        default: defaults,
        stateDirectory: testDir,
      });

      expect(tracker2.cumulative.api).toEqual({
        requests: 5,
        tokens: 1000,
        costUsd: 0.05,
      });
    });

    it("resets session on new create while preserving cumulative", async () => {
      const tracker1 = await UsageTracker.create({
        key: "persist-test",
        default: defaults,
        stateDirectory: testDir,
      });

      tracker1.record({
        api: { requests: 3, tokens: 600, costUsd: 0.03 },
        audio: { requests: 2, durationSeconds: 60 },
      });
      await tracker1.save();

      const tracker2 = await UsageTracker.create({
        key: "persist-test",
        default: defaults,
        stateDirectory: testDir,
      });

      // Session is zeroed out
      expect(tracker2.session).toEqual(defaults);
      // Cumulative is preserved
      expect(tracker2.cumulative.api.requests).toBe(3);
      expect(tracker2.cumulative.audio.durationSeconds).toBe(60);
    });

    it("preserves trackingSince across instances", async () => {
      const tracker1 = await UsageTracker.create({
        key: "persist-test",
        default: defaults,
        stateDirectory: testDir,
      });

      const originalTrackingSince = tracker1.trackingSince;
      await tracker1.save();

      const tracker2 = await UsageTracker.create({
        key: "persist-test",
        default: defaults,
        stateDirectory: testDir,
      });

      expect(tracker2.trackingSince).toBe(originalTrackingSince);
    });

    it("save() force-saves to disk", async () => {
      const tracker = await UsageTracker.create({
        key: "save-test",
        default: defaults,
        stateDirectory: testDir,
      });

      tracker.record({ api: { requests: 1, tokens: 100, costUsd: 0.01 } });
      await tracker.save();

      const filePath = path.join(testDir, "save-test.json");
      expect(fs.existsSync(filePath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
        value: { cumulative: { api: { requests: number } } };
      };
      expect(data.value.cumulative.api.requests).toBe(1);
    });
  });

  describe("realistic scenario", () => {
    it("simulates multi-provider usage with restart", async () => {
      // Session 1: record various metrics
      const session1 = await UsageTracker.create({
        key: "realistic",
        default: defaults,
        stateDirectory: testDir,
      });

      session1.record({ api: { requests: 1, tokens: 500, costUsd: 0.01 } });
      session1.record({ api: { requests: 1, tokens: 300, costUsd: 0.008 } });
      session1.record({ audio: { requests: 1, durationSeconds: 45 } });

      expect(session1.session.api.requests).toBe(2);
      expect(session1.cumulative.api.tokens).toBe(800);
      await session1.save();

      // Session 2: restart — cumulative persists, session resets
      const session2 = await UsageTracker.create({
        key: "realistic",
        default: defaults,
        stateDirectory: testDir,
      });

      expect(session2.session.api.requests).toBe(0);
      expect(session2.cumulative.api.requests).toBe(2);
      expect(session2.cumulative.api.tokens).toBe(800);
      expect(session2.cumulative.audio.durationSeconds).toBe(45);

      // Record more in session 2
      session2.record({ api: { requests: 1, tokens: 200, costUsd: 0.005 } });

      expect(session2.session.api.requests).toBe(1);
      expect(session2.cumulative.api.requests).toBe(3);
      expect(session2.cumulative.api.tokens).toBe(1000);
    });
  });
});
