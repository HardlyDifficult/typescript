import { describe, it, expect } from "vitest";
import { classifyPRs } from "../src/classification.js";
import type { ScannedPR, PRStatus } from "../src/types.js";
import type { PullRequest, Repository } from "@hardlydifficult/github";

function makePR(status: PRStatus): ScannedPR {
  const pr: PullRequest = {
    id: 1,
    number: 1,
    title: "Test PR",
    body: null,
    state: "open",
    draft: status === "draft",
    user: { login: "user", id: 1, avatar_url: "", html_url: "" },
    html_url: "https://github.com/owner/repo/pull/1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    closed_at: null,
    merged_at: null,
    head: {
      ref: "feature",
      sha: "abc",
      repo: null,
    },
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
    mergeable: true,
    mergeable_state: "mergeable",
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
      allPassed: true,
      summary: "CI passed: 1 checks",
    },
    ciSummary: "CI passed: 1 checks",
    hasConflicts: false,
    waitingOnBot: false,
    daysSinceUpdate: 0,
  };
}

describe("classifyPRs", () => {
  it("places ready_to_merge into readyForHuman", () => {
    const result = classifyPRs([makePR("ready_to_merge")]);
    expect(result.readyForHuman).toHaveLength(1);
    expect(result.needsBotBump).toHaveLength(0);
    expect(result.inProgress).toHaveLength(0);
    expect(result.blocked).toHaveLength(0);
  });

  it("places needs_review into readyForHuman", () => {
    const result = classifyPRs([makePR("needs_review")]);
    expect(result.readyForHuman).toHaveLength(1);
  });

  it("places needs_human_review into readyForHuman", () => {
    const result = classifyPRs([makePR("needs_human_review")]);
    expect(result.readyForHuman).toHaveLength(1);
  });

  it("places changes_requested into readyForHuman", () => {
    const result = classifyPRs([makePR("changes_requested")]);
    expect(result.readyForHuman).toHaveLength(1);
  });

  it("places approved into readyForHuman", () => {
    const result = classifyPRs([makePR("approved")]);
    expect(result.readyForHuman).toHaveLength(1);
  });

  it("places waiting_on_bot into needsBotBump", () => {
    const result = classifyPRs([makePR("waiting_on_bot")]);
    expect(result.needsBotBump).toHaveLength(1);
    expect(result.readyForHuman).toHaveLength(0);
    expect(result.inProgress).toHaveLength(0);
    expect(result.blocked).toHaveLength(0);
  });

  it("places ci_running into inProgress", () => {
    const result = classifyPRs([makePR("ci_running")]);
    expect(result.inProgress).toHaveLength(1);
    expect(result.readyForHuman).toHaveLength(0);
  });

  it("places ai_processing into inProgress", () => {
    const result = classifyPRs([makePR("ai_processing")]);
    expect(result.inProgress).toHaveLength(1);
  });

  it("places ai_reviewing into inProgress", () => {
    const result = classifyPRs([makePR("ai_reviewing")]);
    expect(result.inProgress).toHaveLength(1);
  });

  it("places draft into blocked", () => {
    const result = classifyPRs([makePR("draft")]);
    expect(result.blocked).toHaveLength(1);
    expect(result.readyForHuman).toHaveLength(0);
  });

  it("places ci_failed into blocked", () => {
    const result = classifyPRs([makePR("ci_failed")]);
    expect(result.blocked).toHaveLength(1);
  });

  it("places has_conflicts into blocked", () => {
    const result = classifyPRs([makePR("has_conflicts")]);
    expect(result.blocked).toHaveLength(1);
  });

  it("all field contains all PRs", () => {
    const prs = [
      makePR("draft"),
      makePR("ci_running"),
      makePR("ready_to_merge"),
    ];
    const result = classifyPRs(prs);
    expect(result.all).toHaveLength(3);
  });

  it("handles empty array", () => {
    const result = classifyPRs([]);
    expect(result.all).toHaveLength(0);
    expect(result.readyForHuman).toHaveLength(0);
    expect(result.needsBotBump).toHaveLength(0);
    expect(result.inProgress).toHaveLength(0);
    expect(result.blocked).toHaveLength(0);
  });

  it("correctly classifies multiple PRs with different statuses", () => {
    const prs = [
      makePR("ready_to_merge"),
      makePR("waiting_on_bot"),
      makePR("ci_running"),
      makePR("draft"),
      makePR("needs_review"),
    ];
    const result = classifyPRs(prs);
    expect(result.readyForHuman).toHaveLength(2); // ready_to_merge + needs_review
    expect(result.needsBotBump).toHaveLength(1);
    expect(result.inProgress).toHaveLength(1);
    expect(result.blocked).toHaveLength(1);
  });
});
