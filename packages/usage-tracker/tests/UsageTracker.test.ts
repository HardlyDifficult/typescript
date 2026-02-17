import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UsageTracker } from "../src/UsageTracker.js";
import { SpendLimitExceededError } from "../src/SpendLimitExceededError.js";

const defaults = {
  api: { requests: 0, tokens: 0, costUsd: 0 },
  audio: { requests: 0, durationSeconds: 0 },
};

/** Defaults with CostUsd-convention fields for spend limit tests. */
const spendDefaults = {
  api: { requests: 0, tokens: 0, estimatedCostUsd: 0 },
  code: { sessions: 0, totalCostUsd: 0 },
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

  describe("costInWindow", () => {
    it("returns 0 when no cost fields exist", async () => {
      const tracker = await UsageTracker.create({
        key: "no-cost",
        default: { requests: 0, tokens: 0 },
        stateDirectory: testDir,
      });

      tracker.record({ requests: 1, tokens: 100 });
      expect(tracker.costInWindow(60_000)).toBe(0);
    });

    it("tracks cost from *CostUsd fields automatically", async () => {
      const tracker = await UsageTracker.create({
        key: "cost-track",
        default: spendDefaults,
        stateDirectory: testDir,
      });

      tracker.record({ api: { estimatedCostUsd: 0.05 } });
      tracker.record({ code: { totalCostUsd: 1.50 } });

      expect(tracker.costInWindow(60_000)).toBeCloseTo(1.55);
    });

    it("sums cost across multiple CostUsd fields in a single record", async () => {
      const tracker = await UsageTracker.create({
        key: "multi-cost",
        default: spendDefaults,
        stateDirectory: testDir,
      });

      tracker.record({
        api: { estimatedCostUsd: 0.10 },
        code: { totalCostUsd: 2.00 },
      });

      expect(tracker.costInWindow(60_000)).toBeCloseTo(2.10);
    });

    it("excludes entries outside the window", async () => {
      const tracker = await UsageTracker.create({
        key: "window-test",
        default: spendDefaults,
        stateDirectory: testDir,
      });

      // Record an entry, then advance time past the window
      vi.useFakeTimers();
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      tracker.record({ api: { estimatedCostUsd: 1.00 } });

      // Move forward 5 minutes
      vi.setSystemTime(baseTime + 5 * 60_000);
      tracker.record({ api: { estimatedCostUsd: 0.50 } });

      // 1-minute window should only include the recent entry
      expect(tracker.costInWindow(60_000)).toBeCloseTo(0.50);
      // 10-minute window should include both
      expect(tracker.costInWindow(10 * 60_000)).toBeCloseTo(1.50);

      vi.useRealTimers();
    });

    it("does not track records with zero cost", async () => {
      const tracker = await UsageTracker.create({
        key: "zero-cost",
        default: spendDefaults,
        stateDirectory: testDir,
      });

      // Record with no cost fields
      tracker.record({ api: { requests: 1, tokens: 500 } });

      expect(tracker.costInWindow(60_000)).toBe(0);
    });
  });

  describe("spend limits", () => {
    it("assertWithinSpendLimits passes when under limit", async () => {
      const tracker = await UsageTracker.create({
        key: "limit-pass",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 5, label: "1 minute" },
        ],
      });

      tracker.record({ api: { estimatedCostUsd: 1.00 } });
      expect(() => tracker.assertWithinSpendLimits()).not.toThrow();
    });

    it("assertWithinSpendLimits throws when over limit", async () => {
      const tracker = await UsageTracker.create({
        key: "limit-fail",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 1, label: "1 minute" },
        ],
      });

      tracker.record({ api: { estimatedCostUsd: 1.50 } });

      expect(() => tracker.assertWithinSpendLimits()).toThrow(
        SpendLimitExceededError,
      );
    });

    it("throws for the first exceeded limit", async () => {
      const tracker = await UsageTracker.create({
        key: "multi-limit",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 1, label: "1 minute" },
          { windowMs: 600_000, maxSpendUsd: 5, label: "10 minutes" },
        ],
      });

      tracker.record({ api: { estimatedCostUsd: 1.50 } });

      try {
        tracker.assertWithinSpendLimits();
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(SpendLimitExceededError);
        const e = err as SpendLimitExceededError;
        expect(e.status.limit.label).toBe("1 minute");
        expect(e.status.spentUsd).toBeCloseTo(1.50);
        expect(e.status.exceeded).toBe(true);
      }
    });

    it("is a no-op when no spend limits configured", async () => {
      const tracker = await UsageTracker.create({
        key: "no-limits",
        default: spendDefaults,
        stateDirectory: testDir,
      });

      tracker.record({ api: { estimatedCostUsd: 1000 } });
      expect(() => tracker.assertWithinSpendLimits()).not.toThrow();
    });

    it("fires onSpendLimitExceeded callback", async () => {
      const exceeded = vi.fn();
      const tracker = await UsageTracker.create({
        key: "callback-test",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 1, label: "1 minute" },
        ],
        onSpendLimitExceeded: exceeded,
      });

      tracker.record({ api: { estimatedCostUsd: 0.50 } });
      expect(exceeded).not.toHaveBeenCalled();

      tracker.record({ api: { estimatedCostUsd: 0.60 } });
      expect(exceeded).toHaveBeenCalledOnce();
      expect(exceeded.mock.calls[0]![0]!.exceeded).toBe(true);
      expect(exceeded.mock.calls[0]![0]!.limit.label).toBe("1 minute");
    });

    it("does not fire callback for records with zero cost", async () => {
      const exceeded = vi.fn();
      const tracker = await UsageTracker.create({
        key: "no-fire",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 0.01, label: "1 minute" },
        ],
        onSpendLimitExceeded: exceeded,
      });

      // Record without cost fields — should never trigger limit check
      tracker.record({ api: { requests: 1 } });
      expect(exceeded).not.toHaveBeenCalled();
    });
  });

  describe("spendStatus", () => {
    it("returns empty array when no limits configured", async () => {
      const tracker = await UsageTracker.create({
        key: "no-status",
        default: spendDefaults,
        stateDirectory: testDir,
      });

      expect(tracker.spendStatus()).toEqual([]);
    });

    it("returns status for each configured limit", async () => {
      const tracker = await UsageTracker.create({
        key: "status-test",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 5, label: "1 minute" },
          { windowMs: 600_000, maxSpendUsd: 20, label: "10 minutes" },
        ],
      });

      tracker.record({ api: { estimatedCostUsd: 3.00 } });

      const statuses = tracker.spendStatus();
      expect(statuses).toHaveLength(2);

      expect(statuses[0]!.spentUsd).toBeCloseTo(3.00);
      expect(statuses[0]!.remainingUsd).toBeCloseTo(2.00);
      expect(statuses[0]!.exceeded).toBe(false);
      expect(statuses[0]!.resumesAt).toBeNull();

      expect(statuses[1]!.spentUsd).toBeCloseTo(3.00);
      expect(statuses[1]!.remainingUsd).toBeCloseTo(17.00);
      expect(statuses[1]!.exceeded).toBe(false);
    });

    it("calculates resumesAt when exceeded", async () => {
      vi.useFakeTimers();
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      const tracker = await UsageTracker.create({
        key: "resume-test",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 2, label: "1 minute" },
        ],
      });

      tracker.record({ api: { estimatedCostUsd: 1.50 } });

      vi.setSystemTime(baseTime + 10_000);
      tracker.record({ api: { estimatedCostUsd: 1.00 } });

      const status = tracker.spendStatus()[0]!;
      expect(status.exceeded).toBe(true);
      // The first entry ($1.50) needs to leave the window.
      // It was recorded at baseTime, so it leaves at baseTime + 60_000.
      expect(status.resumesAt).toEqual(new Date(baseTime + 60_000));

      vi.useRealTimers();
    });
  });

  describe("spend entry persistence", () => {
    it("persists spend entries across restarts", async () => {
      const tracker1 = await UsageTracker.create({
        key: "spend-persist",
        default: spendDefaults,
        stateDirectory: testDir,
      });

      tracker1.record({ api: { estimatedCostUsd: 2.00 } });
      tracker1.record({ code: { totalCostUsd: 3.00 } });
      await tracker1.save();

      const tracker2 = await UsageTracker.create({
        key: "spend-persist",
        default: spendDefaults,
        stateDirectory: testDir,
      });

      expect(tracker2.costInWindow(60_000)).toBeCloseTo(5.00);
    });

    it("prunes stale entries on restart", async () => {
      vi.useFakeTimers();
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      const tracker1 = await UsageTracker.create({
        key: "prune-test",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 10, label: "1 minute" },
        ],
      });

      tracker1.record({ api: { estimatedCostUsd: 1.00 } });
      await tracker1.save();

      // Restart 2 minutes later — entry should be pruned
      vi.setSystemTime(baseTime + 120_000);

      const tracker2 = await UsageTracker.create({
        key: "prune-test",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 10, label: "1 minute" },
        ],
      });

      expect(tracker2.costInWindow(60_000)).toBe(0);

      vi.useRealTimers();
    });

    it("handles state files without spendEntries (backward compat)", async () => {
      // Write a state file without spendEntries (simulating old format)
      const filePath = path.join(testDir, "old-format.json");
      const oldState = {
        value: {
          cumulative: spendDefaults,
          session: spendDefaults,
          trackingSince: new Date().toISOString(),
          sessionStartedAt: new Date().toISOString(),
          // no spendEntries field
        },
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(oldState));

      const tracker = await UsageTracker.create({
        key: "old-format",
        default: spendDefaults,
        stateDirectory: testDir,
        spendLimits: [
          { windowMs: 60_000, maxSpendUsd: 10, label: "1 minute" },
        ],
      });

      // Should work fine with empty entries
      expect(tracker.costInWindow(60_000)).toBe(0);
      expect(() => tracker.assertWithinSpendLimits()).not.toThrow();

      // Should be able to record new entries
      tracker.record({ api: { estimatedCostUsd: 1.00 } });
      expect(tracker.costInWindow(60_000)).toBeCloseTo(1.00);
    });
  });
});
