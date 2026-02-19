import { describe, it, expect } from "vitest";
import { getAvailableActions } from "../src/actions.js";
import type { ScannedPR, PRStatus } from "../src/types.js";
import type { PullRequest, Repository } from "@hardlydifficult/github";

function makeScannedPR(
  status: PRStatus,
  overrides: Partial<{
    draft: boolean;
    merged_at: string | null;
    hasConflicts: boolean;
    ciAllPassed: boolean;
  }> = {}
): ScannedPR {
  const draft = overrides.draft ?? status === "draft";
  const merged_at = overrides.merged_at ?? null;
  const hasConflicts = overrides.hasConflicts ?? false;
  const ciAllPassed = overrides.ciAllPassed ?? true;

  const pr: PullRequest = {
    id: 1,
    number: 1,
    title: "Test PR",
    body: null,
    state: "open",
    draft,
    user: { login: "user", id: 1, avatar_url: "", html_url: "" },
    html_url: "https://github.com/owner/repo/pull/1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    closed_at: null,
    merged_at,
    head: { ref: "feature", sha: "abc", repo: null },
    base: {
      ref: "main",
      sha: "def",
      repo: {
        id: 1,
        name: "repo",
        full_name: "owner/repo",
        owner: { login: "owner", id: 1 },
        html_url: "https://github.com/owner/repo",
        default_branch: "main",
        description: null,
      },
    },
    mergeable: hasConflicts ? false : true,
    mergeable_state: hasConflicts ? "conflicting" : "mergeable",
    labels: [],
    requested_reviewers: [],
    assignees: [],
  };

  const repo: Repository = {
    id: 1,
    name: "repo",
    full_name: "owner/repo",
    owner: { login: "owner", id: 1 },
    html_url: "https://github.com/owner/repo",
    default_branch: "main",
    description: null,
  };

  return {
    pr,
    repo,
    status,
    ciStatus: {
      isRunning: false,
      hasFailed: false,
      allPassed: ciAllPassed,
      summary: "CI passed: 1 checks",
    },
    ciSummary: "CI passed: 1 checks",
    hasConflicts,
    waitingOnBot: false,
    daysSinceUpdate: 0,
  };
}

describe("getAvailableActions", () => {
  describe("ready_to_merge", () => {
    it("returns merge action", () => {
      const pr = makeScannedPR("ready_to_merge");
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions.map((a) => a.type)).toEqual(["merge"]);
    });
  });

  describe("approved", () => {
    it("returns merge action", () => {
      const pr = makeScannedPR("approved");
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions.map((a) => a.type)).toEqual(["merge"]);
    });
  });

  describe("needs_human_review", () => {
    it("returns merge action", () => {
      const pr = makeScannedPR("needs_human_review");
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions.map((a) => a.type)).toEqual(["merge"]);
    });
  });

  describe("ci_failed", () => {
    it("returns fix_ci for work PRs", () => {
      const pr = makeScannedPR("ci_failed");
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: true,
      });
      expect(actions.map((a) => a.type)).toContain("fix_ci");
    });

    it("returns recreate for dependabot PRs", () => {
      const pr = makeScannedPR("ci_failed");
      const actions = getAvailableActions(pr, {
        isDependabot: true,
        isWorkPR: false,
      });
      expect(actions.map((a) => a.type)).toContain("recreate");
    });

    it("returns both fix_ci and recreate when both flags set", () => {
      const pr = makeScannedPR("ci_failed");
      const actions = getAvailableActions(pr, {
        isDependabot: true,
        isWorkPR: true,
      });
      const types = actions.map((a) => a.type);
      expect(types).toContain("fix_ci");
      expect(types).toContain("recreate");
    });

    it("returns no actions when neither flag set", () => {
      const pr = makeScannedPR("ci_failed");
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions).toHaveLength(0);
    });
  });

  describe("has_conflicts", () => {
    it("returns recreate for dependabot PRs", () => {
      const pr = makeScannedPR("has_conflicts", { hasConflicts: true });
      const actions = getAvailableActions(pr, {
        isDependabot: true,
        isWorkPR: false,
      });
      expect(actions.map((a) => a.type)).toEqual(["recreate"]);
    });

    it("returns no actions for non-dependabot PRs", () => {
      const pr = makeScannedPR("has_conflicts", { hasConflicts: true });
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions).toHaveLength(0);
    });
  });

  describe("draft", () => {
    it("returns mark_ready when CI passed and no conflicts", () => {
      const pr = makeScannedPR("draft", {
        draft: true,
        ciAllPassed: true,
        hasConflicts: false,
      });
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions.map((a) => a.type)).toEqual(["mark_ready"]);
    });

    it("returns no actions when CI not passed", () => {
      const pr = makeScannedPR("draft", { draft: true, ciAllPassed: false });
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions).toHaveLength(0);
    });

    it("returns no actions when has conflicts", () => {
      const pr = makeScannedPR("draft", {
        draft: true,
        ciAllPassed: true,
        hasConflicts: true,
      });
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions).toHaveLength(0);
    });
  });

  describe("ci_running", () => {
    it("returns enable_auto_merge for non-draft, non-conflicting, unmerged PR", () => {
      const pr = makeScannedPR("ci_running", {
        draft: false,
        merged_at: null,
        hasConflicts: false,
      });
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions.map((a) => a.type)).toEqual(["enable_auto_merge"]);
    });

    it("returns no actions when PR is draft", () => {
      const pr = makeScannedPR("ci_running", { draft: true });
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions).toHaveLength(0);
    });

    it("returns no actions when PR has conflicts", () => {
      const pr = makeScannedPR("ci_running", { hasConflicts: true });
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions).toHaveLength(0);
    });

    it("returns no actions when PR is already merged", () => {
      const pr = makeScannedPR("ci_running", {
        merged_at: "2024-01-01T00:00:00Z",
      });
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions).toHaveLength(0);
    });
  });

  describe("needs_review", () => {
    it("returns enable_auto_merge for eligible PRs", () => {
      const pr = makeScannedPR("needs_review", {
        draft: false,
        merged_at: null,
        hasConflicts: false,
      });
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions.map((a) => a.type)).toEqual(["enable_auto_merge"]);
    });
  });

  describe("statuses with no actions", () => {
    it.each([
      "waiting_on_bot",
      "ai_processing",
      "ai_reviewing",
      "changes_requested",
    ] as PRStatus[])("returns empty actions for %s", (status) => {
      const pr = makeScannedPR(status);
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions).toHaveLength(0);
    });
  });

  describe("action descriptors", () => {
    it("merge action has correct label and description", () => {
      const pr = makeScannedPR("ready_to_merge");
      const actions = getAvailableActions(pr, {
        isDependabot: false,
        isWorkPR: false,
      });
      expect(actions[0]).toMatchObject({
        type: "merge",
        label: "Merge",
        description: "Squash and merge this PR",
      });
    });
  });
});
