/**
 * Extra tests to cover remaining branches in UsageTracker and deepAdd.
 * - UsageTracker.ts line 140: !Array.isArray(spendEntries) → reset to []
 * - UsageTracker.ts line 276: timestamp < cutoff continue (entry before window)
 * - deepAdd.ts line 16: !hasOwnProperty continue branch
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BudgetExceededError } from "../src/BudgetExceededError.js";
import { UsageTracker } from "../src/UsageTracker.js";
import { deepAdd } from "../src/deepAdd.js";

const spendMetrics = {
  api: { requests: 0, estimatedCostUsd: 0 },
};

let testDir: string;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "usage-tracker-extra-"));
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ─── UsageTracker.ts line 140 ────────────────────────────────────────────────

describe("UsageTracker - corrupted spendEntries (line 140)", () => {
  it("resets spendEntries to [] when persisted state has non-array spendEntries", async () => {
    // Write a pre-existing state file with spendEntries: null
    const stateFile = path.join(testDir, "corrupt-tracker.json");
    const corruptState = JSON.stringify({
      cumulative: { api: { requests: 0, estimatedCostUsd: 0 } },
      session: { api: { requests: 0, estimatedCostUsd: 0 } },
      trackingSince: new Date().toISOString(),
      sessionStartedAt: new Date().toISOString(),
      spendEntries: null, // corrupted - not an array
    });
    fs.writeFileSync(stateFile, corruptState, "utf-8");

    // Open should detect and fix the corrupt spendEntries
    const usage = await UsageTracker.open("corrupt-tracker", spendMetrics, {
      dir: testDir,
    });

    // Should not throw and spend should be 0
    expect(usage.spend("minute")).toBe(0);
  });
});

// ─── UsageTracker.ts line 276 ────────────────────────────────────────────────

describe("UsageTracker - resumesAt with old entries (lines 276, 279)", () => {
  it("skips entries before cutoff when calculating resumesAt (line 276)", async () => {
    const baseTime = Date.now();
    vi.setSystemTime(baseTime);

    const usage = await UsageTracker.open("old-entries-test", spendMetrics, {
      dir: testDir,
      budget: { minute: 1 },
    });

    // Add an old entry (before the 1-minute window)
    usage.track({ api: { estimatedCostUsd: 0.5 } });

    // Move time forward past the 1-minute window so that entry is now BEFORE cutoff
    vi.setSystemTime(baseTime + 65_000); // 65 seconds later

    // Add two entries within the window: first 0.3, second 1.2 (total 1.5 > limit 1.0)
    // excess = 1.5 - 1.0 = 0.5
    // Loop: first entry 0.3 < 0.5 (line 279 false branch taken), second 0.3+1.2=1.5 >= 0.5 (break)
    usage.track({ api: { estimatedCostUsd: 0.3 } });
    vi.setSystemTime(baseTime + 70_000);
    usage.track({ api: { estimatedCostUsd: 1.2 } });

    // Now budget is exceeded: 1.5 > 1.0
    const budgetStatus = usage.budget.minute;
    expect(budgetStatus.exceeded).toBe(true);
    expect(budgetStatus.resumesAt).not.toBeNull();
  });
});

// ─── deepAdd.ts line 16 ──────────────────────────────────────────────────────

describe("deepAdd - non-own property (line 16)", () => {
  it("skips inherited/prototype properties (covers !hasOwnProperty continue)", () => {
    const target = { a: 1, b: 2 };
    // Create a source object with an inherited property
    const proto = { inheritedKey: 999 };
    const source = Object.create(proto) as Record<string, number>;
    source.a = 5;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deepAdd(target, source as any);

    // Only own property 'a' should be added; inherited 'inheritedKey' is skipped
    expect(target.a).toBe(6);
    expect(target.b).toBe(2);
    expect("inheritedKey" in target).toBe(false);
  });
});

describe("deepAdd - null source value (line 27 else-if false branch)", () => {
  it("skips null source values (neither number nor non-null object)", () => {
    const target = { a: 1, b: { c: 2 } };
    // null is typeof 'object' but fails the !== null check → else-if is false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deepAdd(target, { a: null as any, b: null as any });
    // Neither branch executes, target unchanged
    expect(target.a).toBe(1);
    expect(target.b).toEqual({ c: 2 });
  });
});
