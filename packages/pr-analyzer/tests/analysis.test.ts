import { describe, it, expect, vi } from "vitest";
import { analyzePR } from "../src/analysis.js";
import type {
  GitHubClient,
  PullRequest,
  Repository,
  CheckRun,
  PullRequestComment,
  PullRequestReview,
} from "@hardlydifficult/github";
import type { AnalyzerHooks } from "../src/types.js";

// --- Mock builders ---

function makeRepo(): Repository {
  return {
    id: 1,
    name: "repo",
    full_name: "owner/repo",
    owner: { login: "owner", id: 1 },
    html_url: "https://github.com/owner/repo",
    default_branch: "main",
    description: null,
  };
}

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 1,
    number: 42,
    title: "Test PR",
    body: null,
    state: "open",
    draft: false,
    user: { login: "dev", id: 10, avatar_url: "", html_url: "" },
    html_url: "https://github.com/owner/repo/pull/42",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    closed_at: null,
    merged_at: null,
    head: { ref: "feature", sha: "abc", repo: null },
    base: {
      ref: "main",
      sha: "def",
      repo: makeRepo(),
    },
    mergeable: true,
    mergeable_state: "mergeable",
    labels: [],
    requested_reviewers: [],
    assignees: [],
    ...overrides,
  };
}

function makePassedCheck(name = "CI"): CheckRun {
  return {
    id: 1,
    name,
    status: "completed",
    conclusion: "success",
    started_at: "2024-01-01T00:00:00Z",
    completed_at: "2024-01-01T01:00:00Z",
    html_url: "",
  };
}

function makeRunningCheck(name = "CI"): CheckRun {
  return {
    id: 2,
    name,
    status: "in_progress",
    conclusion: null,
    started_at: "2024-01-01T00:00:00Z",
    completed_at: null,
    html_url: "",
  };
}

function makeFailedCheck(name = "CI"): CheckRun {
  return {
    id: 3,
    name,
    status: "completed",
    conclusion: "failure",
    started_at: "2024-01-01T00:00:00Z",
    completed_at: "2024-01-01T01:00:00Z",
    html_url: "",
  };
}

function makeComment(
  login: string,
  body: string,
  created_at: string
): PullRequestComment {
  return {
    id: Math.random(),
    user: { login, id: 99, avatar_url: "", html_url: "" },
    body,
    created_at,
    updated_at: created_at,
    html_url: "",
  };
}

function makeChangesRequestedReview(login = "reviewer"): PullRequestReview {
  return {
    id: 2,
    user: { login, id: 50, avatar_url: "", html_url: "" },
    body: "Please fix this",
    state: "CHANGES_REQUESTED",
    submitted_at: "2024-01-02T00:00:00Z",
    html_url: "",
  };
}

/**
 * Build a mock GitHubClient that returns the provided data.
 */
function makeMockClient(opts: {
  pr: PullRequest;
  checks?: CheckRun[];
  comments?: PullRequestComment[];
  reviews?: PullRequestReview[];
  repo?: Repository;
}): GitHubClient {
  const checks = opts.checks ?? [];
  const comments = opts.comments ?? [];
  const reviews = opts.reviews ?? [];
  const repo = opts.repo ?? makeRepo();

  const prClient = {
    get: vi.fn().mockResolvedValue(opts.pr),
    getCheckRuns: vi.fn().mockResolvedValue(checks),
    getComments: vi.fn().mockResolvedValue(comments),
    getReviews: vi.fn().mockResolvedValue(reviews),
  };

  const repoClient = {
    get: vi.fn().mockResolvedValue(repo),
    pr: vi.fn().mockReturnValue(prClient),
  };

  const client = {
    repo: vi.fn().mockReturnValue(repoClient),
  } as unknown as GitHubClient;

  return client;
}

// --- Tests ---

describe("analyzePR", () => {
  it("returns draft status for draft PRs", async () => {
    const pr = makePR({ draft: true });
    const client = makeMockClient({ pr, checks: [makePassedCheck()] });

    const result = await analyzePR(client, "owner", "repo", pr, "@bot");

    expect(result.status).toBe("draft");
  });

  it("returns ci_running when checks are in progress", async () => {
    const pr = makePR();
    const client = makeMockClient({ pr, checks: [makeRunningCheck()] });

    const result = await analyzePR(client, "owner", "repo", pr, "@bot");

    expect(result.status).toBe("ci_running");
  });

  it("returns ci_failed when checks fail", async () => {
    const pr = makePR();
    const client = makeMockClient({ pr, checks: [makeFailedCheck()] });

    const result = await analyzePR(client, "owner", "repo", pr, "@bot");

    expect(result.status).toBe("ci_failed");
  });

  it("returns ready_to_merge when all checks pass and no issues", async () => {
    const pr = makePR();
    const client = makeMockClient({ pr, checks: [makePassedCheck()] });

    const result = await analyzePR(client, "owner", "repo", pr, "@bot");

    expect(result.status).toBe("ready_to_merge");
  });

  it("returns has_conflicts when PR is not mergeable", async () => {
    const pr = makePR({ mergeable: false, mergeable_state: "conflicting" });
    const client = makeMockClient({ pr, checks: [makePassedCheck()] });

    const result = await analyzePR(client, "owner", "repo", pr, "@bot");

    expect(result.status).toBe("has_conflicts");
  });

  it("returns waiting_on_bot when bot was mentioned and has not replied", async () => {
    const pr = makePR();
    const comments = [
      makeComment("dev", "hey @cursor please fix this", "2024-01-02T00:00:00Z"),
    ];
    const client = makeMockClient({
      pr,
      checks: [makePassedCheck()],
      comments,
    });

    const result = await analyzePR(client, "owner", "repo", pr, "@cursor");

    expect(result.status).toBe("waiting_on_bot");
    expect(result.waitingOnBot).toBe(true);
  });

  it("returns changes_requested when reviewer requests changes", async () => {
    const pr = makePR();
    const reviews = [makeChangesRequestedReview()];
    const client = makeMockClient({ pr, checks: [makePassedCheck()], reviews });

    const result = await analyzePR(client, "owner", "repo", pr, "@bot");

    expect(result.status).toBe("changes_requested");
  });

  it("returns correct hasConflicts flag", async () => {
    const pr = makePR({ mergeable: false, mergeable_state: "conflicting" });
    const client = makeMockClient({ pr, checks: [makePassedCheck()] });

    const result = await analyzePR(client, "owner", "repo", pr, "@bot");

    expect(result.hasConflicts).toBe(true);
  });

  it("includes repo info in result", async () => {
    const pr = makePR();
    const repo = makeRepo();
    const client = makeMockClient({ pr, repo });

    const result = await analyzePR(client, "owner", "repo", pr, "@bot");

    expect(result.repo).toEqual(repo);
  });

  it("not waiting on bot when bot replied after mention", async () => {
    const pr = makePR();
    const comments = [
      makeComment("dev", "hey @cursor please fix this", "2024-01-02T00:00:00Z"),
      makeComment("cursor-bot", "I've made the fix", "2024-01-02T01:00:00Z"),
    ];
    const client = makeMockClient({
      pr,
      checks: [makePassedCheck()],
      comments,
    });

    const result = await analyzePR(client, "owner", "repo", pr, "@cursor");

    expect(result.waitingOnBot).toBe(false);
  });

  it("populates daysSinceUpdate and ciSummary", async () => {
    const pr = makePR();
    const client = makeMockClient({ pr, checks: [makePassedCheck()] });
    const result = await analyzePR(client, "owner", "repo", pr, "@bot");

    expect(result.daysSinceUpdate).toBeGreaterThanOrEqual(0);
    expect(result.ciSummary).toBeDefined();
  });

  // --- AnalyzerHooks extension tests ---

  describe("hooks", () => {
    it("resolveStatus can override core status", async () => {
      const pr = makePR();
      const client = makeMockClient({ pr, checks: [makePassedCheck()] });
      const hooks: AnalyzerHooks = {
        resolveStatus: () => "custom_status",
      };

      const result = await analyzePR(
        client,
        "owner",
        "repo",
        pr,
        "@bot",
        hooks
      );

      expect(result.status).toBe("custom_status");
    });

    it("resolveStatus returning undefined keeps core status", async () => {
      const pr = makePR();
      const client = makeMockClient({ pr, checks: [makePassedCheck()] });
      const hooks: AnalyzerHooks = {
        resolveStatus: () => undefined,
      };

      const result = await analyzePR(
        client,
        "owner",
        "repo",
        pr,
        "@bot",
        hooks
      );

      expect(result.status).toBe("ready_to_merge");
    });

    it("resolveStatus receives core status and analysis details", async () => {
      const pr = makePR();
      const checks = [makePassedCheck()];
      const client = makeMockClient({ pr, checks });
      const resolveStatus = vi.fn().mockReturnValue(undefined);
      const hooks: AnalyzerHooks = { resolveStatus };

      await analyzePR(client, "owner", "repo", pr, "@bot", hooks);

      expect(resolveStatus).toHaveBeenCalledWith(
        "ready_to_merge",
        expect.objectContaining({
          checks: expect.arrayContaining([
            expect.objectContaining({ name: "CI" }),
          ]),
          comments: expect.any(Array),
          reviews: expect.any(Array),
          ciStatus: expect.objectContaining({ allPassed: true }),
          hasConflicts: false,
          waitingOnBot: false,
        })
      );
    });

    it("resolveStatus can override based on core status", async () => {
      const pr = makePR();
      const client = makeMockClient({ pr, checks: [makeFailedCheck()] });
      const hooks: AnalyzerHooks = {
        resolveStatus: (coreStatus) =>
          coreStatus === "ci_failed" ? "ai_processing" : undefined,
      };

      const result = await analyzePR(
        client,
        "owner",
        "repo",
        pr,
        "@bot",
        hooks
      );

      expect(result.status).toBe("ai_processing");
    });

    it("works without hooks (backward compatible)", async () => {
      const pr = makePR();
      const client = makeMockClient({ pr, checks: [makePassedCheck()] });

      const result = await analyzePR(client, "owner", "repo", pr, "@bot");

      expect(result.status).toBe("ready_to_merge");
    });
  });
});
