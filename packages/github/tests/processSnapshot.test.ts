import { describe, it, expect } from "vitest";
import {
  buildSnapshot,
  detectCheckRunChanges,
  detectNewComments,
  detectNewReviews,
} from "../src/polling/processSnapshot.js";
import type {
  CheckRun,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
} from "../src/types.js";

function makePR(): PullRequest {
  return {
    id: 1,
    number: 42,
    title: "Test PR",
    body: null,
    state: "open",
    draft: false,
    user: { login: "author", id: 1, avatar_url: "", html_url: "" },
    html_url: "",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    closed_at: null,
    merged_at: null,
    head: { ref: "feature", sha: "abc123", repo: null },
    base: {
      ref: "main",
      sha: "def456",
      repo: {
        id: 1,
        name: "repo",
        full_name: "owner/repo",
        owner: { login: "owner", id: 1 },
        html_url: "",
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
}

function makeComment(id: number): PullRequestComment {
  return {
    id,
    user: { login: "reviewer", id: 2, avatar_url: "", html_url: "" },
    body: "comment",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    html_url: "",
  };
}

function makeReview(id: number): PullRequestReview {
  return {
    id,
    user: { login: "reviewer", id: 2, avatar_url: "", html_url: "" },
    body: "review",
    state: "APPROVED",
    submitted_at: "2024-01-01T00:00:00Z",
    html_url: "",
  };
}

function makeCheckRun(
  id: number,
  status: CheckRun["status"] = "completed",
  conclusion: CheckRun["conclusion"] = "success"
): CheckRun {
  return {
    id,
    name: "CI",
    status,
    conclusion,
    started_at: "2024-01-01T00:00:00Z",
    completed_at: "2024-01-01T00:01:00Z",
    html_url: "",
  };
}

describe("detectNewComments", () => {
  it("returns comments not in previous snapshot", () => {
    const snapshot = buildSnapshot(
      makePR(),
      "owner",
      "repo",
      { comments: [makeComment(1), makeComment(2)], reviews: [], checkRuns: [] },
      null
    );

    const current = [makeComment(1), makeComment(2), makeComment(3)];
    const result = detectNewComments(current, snapshot);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it("returns empty when all comments already seen", () => {
    const snapshot = buildSnapshot(
      makePR(),
      "owner",
      "repo",
      { comments: [makeComment(1)], reviews: [], checkRuns: [] },
      null
    );

    const result = detectNewComments([makeComment(1)], snapshot);
    expect(result).toHaveLength(0);
  });

  it("returns empty when no comments", () => {
    const snapshot = buildSnapshot(
      makePR(),
      "owner",
      "repo",
      { comments: [], reviews: [], checkRuns: [] },
      null
    );

    const result = detectNewComments([], snapshot);
    expect(result).toHaveLength(0);
  });
});

describe("detectNewReviews", () => {
  it("returns reviews not in previous snapshot", () => {
    const snapshot = buildSnapshot(
      makePR(),
      "owner",
      "repo",
      { comments: [], reviews: [makeReview(1)], checkRuns: [] },
      null
    );

    const current = [makeReview(1), makeReview(2)];
    const result = detectNewReviews(current, snapshot);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("returns empty when all reviews already seen", () => {
    const snapshot = buildSnapshot(
      makePR(),
      "owner",
      "repo",
      { comments: [], reviews: [makeReview(1)], checkRuns: [] },
      null
    );

    const result = detectNewReviews([makeReview(1)], snapshot);
    expect(result).toHaveLength(0);
  });
});

describe("detectCheckRunChanges", () => {
  it("returns check runs with changed status", () => {
    const snapshot = buildSnapshot(
      makePR(),
      "owner",
      "repo",
      {
        comments: [],
        reviews: [],
        checkRuns: [makeCheckRun(1, "in_progress", null)],
      },
      null
    );

    const current = [makeCheckRun(1, "completed", "success")];
    const result = detectCheckRunChanges(current, snapshot);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("completed");
  });

  it("returns check runs with changed conclusion", () => {
    const snapshot = buildSnapshot(
      makePR(),
      "owner",
      "repo",
      {
        comments: [],
        reviews: [],
        checkRuns: [makeCheckRun(1, "completed", "failure")],
      },
      null
    );

    const current = [makeCheckRun(1, "completed", "success")];
    const result = detectCheckRunChanges(current, snapshot);

    expect(result).toHaveLength(1);
    expect(result[0].conclusion).toBe("success");
  });

  it("returns empty when check runs are unchanged", () => {
    const snapshot = buildSnapshot(
      makePR(),
      "owner",
      "repo",
      {
        comments: [],
        reviews: [],
        checkRuns: [makeCheckRun(1, "completed", "success")],
      },
      null
    );

    const result = detectCheckRunChanges(
      [makeCheckRun(1, "completed", "success")],
      snapshot
    );
    expect(result).toHaveLength(0);
  });

  it("returns entirely new check runs", () => {
    const snapshot = buildSnapshot(
      makePR(),
      "owner",
      "repo",
      { comments: [], reviews: [], checkRuns: [] },
      null
    );

    const result = detectCheckRunChanges(
      [makeCheckRun(1, "queued", null)],
      snapshot
    );
    expect(result).toHaveLength(1);
  });
});
