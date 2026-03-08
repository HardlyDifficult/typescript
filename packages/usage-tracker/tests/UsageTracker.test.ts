import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BudgetExceededError } from "../src/BudgetExceededError.js";
import { UsageTracker } from "../src/UsageTracker.js";

const metrics = {
  api: { requests: 0, tokens: 0, costUsd: 0 },
  audio: { requests: 0, durationSeconds: 0 },
};

const spendMetrics = {
  api: { requests: 0, tokens: 0, estimatedCostUsd: 0 },
  code: { sessions: 0, totalCostUsd: 0 },
};

let testDir: string;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "usage-tracker-test-"));
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("UsageTracker", () => {
  describe("open", () => {
    it("starts with zero current and total metrics", async () => {
      const usage = await UsageTracker.open("test", metrics, { dir: testDir });

      expect(usage.current).toEqual(metrics);
      expect(usage.total).toEqual(metrics);
    });

    it("sets startedAt and trackingSince", async () => {
      const before = new Date().toISOString();
      const usage = await UsageTracker.open("test", metrics, { dir: testDir });
      const after = new Date().toISOString();

      expect(usage.startedAt >= before).toBe(true);
      expect(usage.startedAt <= after).toBe(true);
      expect(usage.trackingSince >= before).toBe(true);
      expect(usage.trackingSince <= after).toBe(true);
    });

    it("reports persistence when file storage works", async () => {
      const usage = await UsageTracker.open("test", metrics, { dir: testDir });
      expect(usage.persistent).toBe(true);
    });

    it("rejects invalid budget values", async () => {
      await expect(() =>
        UsageTracker.open("test", spendMetrics, {
          dir: testDir,
          budget: { hour: -1 },
        })
      ).rejects.toThrow('Budget for "hour" must be a finite number >= 0');
    });
  });

  describe("track", () => {
    it("increments current and total simultaneously", async () => {
      const usage = await UsageTracker.open("test", metrics, { dir: testDir });

      usage.track({ api: { requests: 1, tokens: 500, costUsd: 0.01 } });

      expect(usage.current.api).toEqual({
        requests: 1,
        tokens: 500,
        costUsd: 0.01,
      });
      expect(usage.total.api).toEqual({
        requests: 1,
        tokens: 500,
        costUsd: 0.01,
      });
      expect(usage.current.audio).toEqual(metrics.audio);
    });

    it("accepts partial metrics", async () => {
      const usage = await UsageTracker.open("test", metrics, { dir: testDir });

      usage.track({ api: { requests: 1 } });

      expect(usage.current.api.requests).toBe(1);
      expect(usage.current.api.tokens).toBe(0);
      expect(usage.current.api.costUsd).toBe(0);
    });

    it("accumulates across multiple calls", async () => {
      const usage = await UsageTracker.open("test", metrics, { dir: testDir });

      usage.track({ api: { requests: 1, tokens: 100 } });
      usage.track({ api: { requests: 1, tokens: 200 } });
      usage.track({ audio: { requests: 1, durationSeconds: 30 } });

      expect(usage.current.api.requests).toBe(2);
      expect(usage.current.api.tokens).toBe(300);
      expect(usage.current.audio.requests).toBe(1);
      expect(usage.current.audio.durationSeconds).toBe(30);
    });
  });

  describe("persistence", () => {
    it("preserves total data across instances", async () => {
      const usage1 = await UsageTracker.open("persist-test", metrics, {
        dir: testDir,
      });

      usage1.track({ api: { requests: 5, tokens: 1000, costUsd: 0.05 } });
      await usage1.save();

      const usage2 = await UsageTracker.open("persist-test", metrics, {
        dir: testDir,
      });

      expect(usage2.total.api).toEqual({
        requests: 5,
        tokens: 1000,
        costUsd: 0.05,
      });
    });

    it("starts a fresh current run when reopened", async () => {
      const usage1 = await UsageTracker.open("persist-test", metrics, {
        dir: testDir,
      });

      usage1.track({
        api: { requests: 3, tokens: 600, costUsd: 0.03 },
        audio: { requests: 2, durationSeconds: 60 },
      });
      await usage1.save();

      const usage2 = await UsageTracker.open("persist-test", metrics, {
        dir: testDir,
      });

      expect(usage2.current).toEqual(metrics);
      expect(usage2.total.api.requests).toBe(3);
      expect(usage2.total.audio.durationSeconds).toBe(60);
    });

    it("preserves trackingSince across instances", async () => {
      const usage1 = await UsageTracker.open("persist-test", metrics, {
        dir: testDir,
      });

      const trackingSince = usage1.trackingSince;
      await usage1.save();

      const usage2 = await UsageTracker.open("persist-test", metrics, {
        dir: testDir,
      });

      expect(usage2.trackingSince).toBe(trackingSince);
    });

    it("save() writes the current state to disk", async () => {
      const usage = await UsageTracker.open("save-test", metrics, {
        dir: testDir,
      });

      usage.track({ api: { requests: 1, tokens: 100, costUsd: 0.01 } });
      await usage.save();

      const filePath = path.join(testDir, "save-test.json");
      expect(fs.existsSync(filePath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
        value: { cumulative: { api: { requests: number } } };
      };
      expect(data.value.cumulative.api.requests).toBe(1);
    });
  });

  describe("usage flow", () => {
    it("keeps totals across a restart while resetting the current run", async () => {
      const firstRun = await UsageTracker.open("realistic", metrics, {
        dir: testDir,
      });

      firstRun.track({ api: { requests: 1, tokens: 500, costUsd: 0.01 } });
      firstRun.track({ api: { requests: 1, tokens: 300, costUsd: 0.008 } });
      firstRun.track({ audio: { requests: 1, durationSeconds: 45 } });

      expect(firstRun.current.api.requests).toBe(2);
      expect(firstRun.total.api.tokens).toBe(800);
      await firstRun.save();

      const secondRun = await UsageTracker.open("realistic", metrics, {
        dir: testDir,
      });

      expect(secondRun.current.api.requests).toBe(0);
      expect(secondRun.total.api.requests).toBe(2);
      expect(secondRun.total.api.tokens).toBe(800);
      expect(secondRun.total.audio.durationSeconds).toBe(45);

      secondRun.track({ api: { requests: 1, tokens: 200, costUsd: 0.005 } });

      expect(secondRun.current.api.requests).toBe(1);
      expect(secondRun.total.api.requests).toBe(3);
      expect(secondRun.total.api.tokens).toBe(1000);
    });

    it("returns defensive metric snapshots", async () => {
      const usage = await UsageTracker.open("defensive-getters", metrics, {
        dir: testDir,
      });

      const current = usage.current as typeof metrics;
      current.api.requests = 999;

      const total = usage.total as typeof metrics;
      total.audio.durationSeconds = 123;

      expect(usage.current.api.requests).toBe(0);
      expect(usage.total.audio.durationSeconds).toBe(0);
    });
  });

  describe("spend", () => {
    it("returns 0 when there are no tracked cost fields", async () => {
      const usage = await UsageTracker.open(
        "no-cost",
        { requests: 0, tokens: 0 },
        { dir: testDir }
      );

      usage.track({ requests: 1, tokens: 100 });
      expect(usage.spend("minute")).toBe(0);
    });

    it("tracks spend from every *CostUsd field automatically", async () => {
      const usage = await UsageTracker.open("cost-track", spendMetrics, {
        dir: testDir,
      });

      usage.track({ api: { estimatedCostUsd: 0.05 } });
      usage.track({ code: { totalCostUsd: 1.5 } });

      expect(usage.spend("minute")).toBeCloseTo(1.55);
    });

    it("sums multiple cost fields from one track call", async () => {
      const usage = await UsageTracker.open("multi-cost", spendMetrics, {
        dir: testDir,
      });

      usage.track({
        api: { estimatedCostUsd: 0.1 },
        code: { totalCostUsd: 2.0 },
      });

      expect(usage.spend("minute")).toBeCloseTo(2.1);
    });

    it("uses named trailing windows", async () => {
      vi.useFakeTimers();
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      const usage = await UsageTracker.open("window-test", spendMetrics, {
        dir: testDir,
      });

      usage.track({ api: { estimatedCostUsd: 1.0 } });

      vi.setSystemTime(baseTime + 5 * 60_000);
      usage.track({ api: { estimatedCostUsd: 0.5 } });

      expect(usage.spend("minute")).toBeCloseTo(0.5);
      expect(usage.spend("day")).toBeCloseTo(1.5);
    });

    it("ignores records with zero cost", async () => {
      const usage = await UsageTracker.open("zero-cost", spendMetrics, {
        dir: testDir,
      });

      usage.track({ api: { requests: 1, tokens: 500 } });

      expect(usage.spend("minute")).toBe(0);
    });
  });

  describe("budget", () => {
    it("assertBudget passes when usage is under budget", async () => {
      const usage = await UsageTracker.open("budget-pass", spendMetrics, {
        dir: testDir,
        budget: { minute: 5 },
      });

      usage.track({ api: { estimatedCostUsd: 1.0 } });
      expect(() => usage.assertBudget()).not.toThrow();
    });

    it("assertBudget throws when usage is over budget", async () => {
      const usage = await UsageTracker.open("budget-fail", spendMetrics, {
        dir: testDir,
        budget: { minute: 1 },
      });

      usage.track({ api: { estimatedCostUsd: 1.5 } });

      expect(() => usage.assertBudget()).toThrow(BudgetExceededError);
    });

    it("throws the first exceeded configured window", async () => {
      const usage = await UsageTracker.open("multi-budget", spendMetrics, {
        dir: testDir,
        budget: { minute: 1, hour: 5 },
      });

      usage.track({ api: { estimatedCostUsd: 1.5 } });

      try {
        usage.assertBudget();
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BudgetExceededError);
        const budgetError = error as BudgetExceededError;
        expect(budgetError.status.window).toBe("minute");
        expect(budgetError.status.spentUsd).toBeCloseTo(1.5);
        expect(budgetError.status.exceeded).toBe(true);
      }
    });

    it("is a no-op when no budget is configured", async () => {
      const usage = await UsageTracker.open("no-budget", spendMetrics, {
        dir: testDir,
      });

      usage.track({ api: { estimatedCostUsd: 1000 } });
      expect(() => usage.assertBudget()).not.toThrow();
      expect(usage.budget).toEqual({});
    });

    it("returns budget status keyed by window name", async () => {
      const usage = await UsageTracker.open("budget-status", spendMetrics, {
        dir: testDir,
        budget: { minute: 5, hour: 20 },
      });

      usage.track({ api: { estimatedCostUsd: 3.0 } });

      expect(usage.budget.minute).toEqual({
        window: "minute",
        spentUsd: 3,
        limitUsd: 5,
        remainingUsd: 2,
        exceeded: false,
        resumesAt: null,
      });

      expect(usage.budget.hour).toEqual({
        window: "hour",
        spentUsd: 3,
        limitUsd: 20,
        remainingUsd: 17,
        exceeded: false,
        resumesAt: null,
      });
    });

    it("calculates resumesAt when a budget is exceeded", async () => {
      vi.useFakeTimers();
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      const usage = await UsageTracker.open("resume-test", spendMetrics, {
        dir: testDir,
        budget: { minute: 2 },
      });

      usage.track({ api: { estimatedCostUsd: 1.5 } });

      vi.setSystemTime(baseTime + 10_000);
      usage.track({ api: { estimatedCostUsd: 1.0 } });

      expect(usage.budget.minute?.exceeded).toBe(true);
      expect(usage.budget.minute?.resumesAt).toEqual(
        new Date(baseTime + 60_000)
      );
    });

    it("fires onBudgetExceeded only on transition into exceeded", async () => {
      const exceeded = vi.fn();
      const usage = await UsageTracker.open("callback-test", spendMetrics, {
        dir: testDir,
        budget: { minute: 1 },
        onBudgetExceeded: exceeded,
      });

      usage.track({ api: { estimatedCostUsd: 0.5 } });
      expect(exceeded).not.toHaveBeenCalled();

      usage.track({ api: { estimatedCostUsd: 0.6 } });
      expect(exceeded).toHaveBeenCalledOnce();
      expect(exceeded.mock.calls[0]![0]!.window).toBe("minute");
      expect(exceeded.mock.calls[0]![0]!.exceeded).toBe(true);

      usage.track({ api: { estimatedCostUsd: 0.1 } });
      expect(exceeded).toHaveBeenCalledTimes(1);
    });

    it("does not fire onBudgetExceeded immediately from persisted over-budget state", async () => {
      const firstExceeded = vi.fn();
      const usage1 = await UsageTracker.open(
        "persisted-over-budget",
        spendMetrics,
        {
          dir: testDir,
          budget: { minute: 1 },
          onBudgetExceeded: firstExceeded,
        }
      );

      usage1.track({ api: { estimatedCostUsd: 1.5 } });
      expect(firstExceeded).toHaveBeenCalledOnce();
      await usage1.save();

      const secondExceeded = vi.fn();
      const usage2 = await UsageTracker.open(
        "persisted-over-budget",
        spendMetrics,
        {
          dir: testDir,
          budget: { minute: 1 },
          onBudgetExceeded: secondExceeded,
        }
      );

      usage2.track({ api: { estimatedCostUsd: 0.1 } });
      expect(secondExceeded).not.toHaveBeenCalled();
    });

    it("does not fire onBudgetExceeded for zero-cost records", async () => {
      const exceeded = vi.fn();
      const usage = await UsageTracker.open("no-fire", spendMetrics, {
        dir: testDir,
        budget: { minute: 0.01 },
        onBudgetExceeded: exceeded,
      });

      usage.track({ api: { requests: 1 } });
      expect(exceeded).not.toHaveBeenCalled();
    });
  });

  describe("spend entry persistence", () => {
    it("persists spend entries across restarts", async () => {
      const usage1 = await UsageTracker.open("spend-persist", spendMetrics, {
        dir: testDir,
      });

      usage1.track({ api: { estimatedCostUsd: 2.0 } });
      usage1.track({ code: { totalCostUsd: 3.0 } });
      await usage1.save();

      const usage2 = await UsageTracker.open("spend-persist", spendMetrics, {
        dir: testDir,
      });

      expect(usage2.spend("minute")).toBeCloseTo(5.0);
    });

    it("prunes spend entries older than one week on restart", async () => {
      vi.useFakeTimers();
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      const usage1 = await UsageTracker.open("prune-test", spendMetrics, {
        dir: testDir,
        budget: { minute: 10 },
      });

      usage1.track({ api: { estimatedCostUsd: 1.0 } });
      await usage1.save();

      vi.setSystemTime(baseTime + 8 * 24 * 60 * 60_000);

      const usage2 = await UsageTracker.open("prune-test", spendMetrics, {
        dir: testDir,
        budget: { minute: 10 },
      });

      expect(usage2.spend("week")).toBe(0);
    });

    it("backfills missing top-level keys when the metric schema grows", async () => {
      const filePath = path.join(testDir, "schema-migration.json");
      const oldState = {
        value: {
          cumulative: {
            api: { requests: 7, tokens: 500, costUsd: 0.07 },
          },
          session: metrics,
          trackingSince: new Date().toISOString(),
          sessionStartedAt: new Date().toISOString(),
          spendEntries: [],
        },
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(oldState));

      const usage = await UsageTracker.open("schema-migration", metrics, {
        dir: testDir,
      });

      expect(usage.total.api.requests).toBe(7);
      expect(usage.total.api.tokens).toBe(500);
      expect(usage.total.audio).toEqual(metrics.audio);
      expect(usage.total.audio.requests).toBe(0);
    });

    it("backfills missing nested keys when the metric schema grows", async () => {
      const filePath = path.join(testDir, "nested-migration.json");
      const oldState = {
        value: {
          cumulative: {
            api: { requests: 3, tokens: 200 },
            audio: { requests: 1, durationSeconds: 30 },
          },
          session: metrics,
          trackingSince: new Date().toISOString(),
          sessionStartedAt: new Date().toISOString(),
          spendEntries: [],
        },
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(oldState));

      const usage = await UsageTracker.open("nested-migration", metrics, {
        dir: testDir,
      });

      expect(usage.total.api.requests).toBe(3);
      expect(usage.total.api.tokens).toBe(200);
      expect(usage.total.api.costUsd).toBe(0);
    });

    it("supports old persisted state without spendEntries", async () => {
      const filePath = path.join(testDir, "old-format.json");
      const oldState = {
        value: {
          cumulative: spendMetrics,
          session: spendMetrics,
          trackingSince: new Date().toISOString(),
          sessionStartedAt: new Date().toISOString(),
        },
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(oldState));

      const usage = await UsageTracker.open("old-format", spendMetrics, {
        dir: testDir,
        budget: { minute: 10 },
      });

      expect(usage.spend("minute")).toBe(0);
      expect(() => usage.assertBudget()).not.toThrow();

      usage.track({ api: { estimatedCostUsd: 1.0 } });
      expect(usage.spend("minute")).toBeCloseTo(1.0);
    });
  });
});
