import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PRWatcher } from "../src/PRWatcher.js";
import type {
  PREvent,
  CommentEvent,
  ReviewEvent,
  CheckRunEvent,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
  CheckRun,
} from "../src/types.js";

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

const mockOctokit = {
  pulls: {
    list: vi.fn(),
    get: vi.fn(),
  },
  checks: {
    listForRef: vi.fn(),
  },
  issues: {
    listComments: vi.fn(),
  },
  search: {
    issuesAndPullRequests: vi.fn(),
  },
} as unknown as import("@octokit/rest").Octokit;

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 1,
    number: 42,
    title: "Test PR",
    body: null,
    state: "open",
    draft: false,
    user: { login: "author", id: 1, avatar_url: "", html_url: "" },
    html_url: "https://github.com/owner/repo/pull/42",
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
      },
    },
    mergeable: true,
    mergeable_state: "mergeable",
    labels: [],
    requested_reviewers: [],
    assignees: [],
    ...overrides,
  };
}

function makeComment(
  overrides: Partial<PullRequestComment> = {}
): PullRequestComment {
  return {
    id: 100,
    user: { login: "reviewer", id: 2, avatar_url: "", html_url: "" },
    body: "Looks good",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    html_url: "",
    ...overrides,
  };
}

function makeReview(
  overrides: Partial<PullRequestReview> = {}
): PullRequestReview {
  return {
    id: 200,
    user: { login: "reviewer", id: 2, avatar_url: "", html_url: "" },
    body: "Approved",
    state: "APPROVED",
    submitted_at: "2024-01-01T00:00:00Z",
    html_url: "",
    ...overrides,
  };
}

function makeCheckRun(overrides: Partial<CheckRun> = {}): CheckRun {
  return {
    id: 300,
    name: "CI",
    status: "completed",
    conclusion: "success",
    started_at: "2024-01-01T00:00:00Z",
    completed_at: "2024-01-01T00:01:00Z",
    html_url: "",
    ...overrides,
  };
}

function stubEmptyActivity(): void {
  (
    mockOctokit.issues.listComments as ReturnType<typeof vi.fn>
  ).mockResolvedValue({
    data: [],
  });
  (mockOctokit.pulls as { listReviews: ReturnType<typeof vi.fn> }).listReviews =
    vi.fn().mockResolvedValue({ data: [] });
  (mockOctokit.checks.listForRef as ReturnType<typeof vi.fn>).mockResolvedValue(
    {
      data: { check_runs: [] },
    }
  );
}

function stubActivity(
  comments: PullRequestComment[],
  reviews: PullRequestReview[],
  checkRuns: CheckRun[]
): void {
  (
    mockOctokit.issues.listComments as ReturnType<typeof vi.fn>
  ).mockResolvedValue({
    data: comments,
  });
  (mockOctokit.pulls as { listReviews: ReturnType<typeof vi.fn> }).listReviews =
    vi.fn().mockResolvedValue({ data: reviews });
  (mockOctokit.checks.listForRef as ReturnType<typeof vi.fn>).mockResolvedValue(
    {
      data: { check_runs: checkRuns },
    }
  );
}

describe("PRWatcher", () => {
  let watcher: PRWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (
      mockOctokit.search.issuesAndPullRequests as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      data: { items: [] },
    });
  });

  afterEach(() => {
    watcher?.stop();
    vi.useRealTimers();
  });

  describe("onNewPR", () => {
    it("fires for each open PR on first poll", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      watcher.onNewPR((e) => events.push(e));
      await watcher.start();

      expect(events).toHaveLength(1);
      expect(events[0].pr.number).toBe(42);
      expect(events[0].repo).toEqual({ owner: "owner", name: "repo" });
    });

    it("fires for PRs that appear after first poll", async () => {
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      stubEmptyActivity();

      const events: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onNewPR((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(0);

      const newPR = makePR({ number: 99 });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [newPR],
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].pr.number).toBe(99);
    });

    it("does not fire for already-tracked PRs", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onNewPR((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
    });
  });

  describe("onComment", () => {
    it("fires for new comments after first poll", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: CommentEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onComment((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(0);

      const comment = makeComment({ id: 101 });
      stubActivity([comment], [], []);

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].comment.id).toBe(101);
      expect(events[0].pr.number).toBe(42);
    });

    it("does not fire for already-seen comments", async () => {
      const pr = makePR();
      const comment = makeComment({ id: 101 });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubActivity([comment], [], []);

      const events: CommentEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onComment((e) => events.push(e));
      await watcher.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(0);
    });
  });

  describe("onReview", () => {
    it("fires for new reviews after first poll", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: ReviewEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onReview((e) => events.push(e));
      await watcher.start();

      const review = makeReview({ id: 201, state: "CHANGES_REQUESTED" });
      stubActivity([], [review], []);

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].review.state).toBe("CHANGES_REQUESTED");
    });
  });

  describe("onCheckRun", () => {
    it("fires for new check runs after first poll", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: CheckRunEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onCheckRun((e) => events.push(e));
      await watcher.start();

      const checkRun = makeCheckRun({
        id: 301,
        status: "in_progress",
        conclusion: null,
      });
      stubActivity([], [], [checkRun]);

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].checkRun.status).toBe("in_progress");
    });

    it("fires when check run status changes", async () => {
      const pr = makePR();
      const initialCheck = makeCheckRun({
        id: 301,
        status: "in_progress",
        conclusion: null,
      });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubActivity([], [], [initialCheck]);

      const events: CheckRunEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onCheckRun((e) => events.push(e));
      await watcher.start();

      const completedCheck = makeCheckRun({
        id: 301,
        status: "completed",
        conclusion: "success",
      });
      stubActivity([], [], [completedCheck]);

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].checkRun.status).toBe("completed");
      expect(events[0].checkRun.conclusion).toBe("success");
    });

    it("does not fire when check run is unchanged", async () => {
      const pr = makePR();
      const checkRun = makeCheckRun({ id: 301 });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubActivity([], [], [checkRun]);

      const events: CheckRunEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onCheckRun((e) => events.push(e));
      await watcher.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(0);
    });
  });

  describe("onMerged", () => {
    it("fires when a tracked PR gets merged", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onMerged((e) => events.push(e));
      await watcher.start();

      const mergedPR = makePR({
        state: "closed",
        merged_at: "2024-01-02T00:00:00Z",
        closed_at: "2024-01-02T00:00:00Z",
      });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [mergedPR],
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].pr.merged_at).toBe("2024-01-02T00:00:00Z");
    });

    it("fires when a PR disappears from open list (merged)", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onMerged((e) => events.push(e));
      await watcher.start();

      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      const freshPR = makePR({
        state: "closed",
        merged_at: "2024-01-02T00:00:00Z",
      });
      (mockOctokit.pulls.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: freshPR,
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
    });
  });

  describe("onClosed", () => {
    it("fires when a tracked PR is closed without merge", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onClosed((e) => events.push(e));
      await watcher.start();

      const closedPR = makePR({
        state: "closed",
        closed_at: "2024-01-02T00:00:00Z",
      });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [closedPR],
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].pr.state).toBe("closed");
      expect(events[0].pr.merged_at).toBeNull();
    });
  });

  describe("onError", () => {
    it("fires when polling fails", async () => {
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API rate limit")
      );

      const errors: Error[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      watcher.onError((e) => errors.push(e));
      await watcher.start();

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("API rate limit");
    });

    it("fires when a callback throws", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const errors: Error[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      watcher.onNewPR(() => {
        throw new Error("callback broke");
      });
      watcher.onError((e) => errors.push(e));
      await watcher.start();

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("callback broke");
    });
  });

  describe("unsubscribe", () => {
    it("returns unsubscribe function that removes callback", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      const unsub = watcher.onNewPR((e) => events.push(e));
      unsub();
      await watcher.start();

      expect(events).toHaveLength(0);
    });
  });

  describe("myPRs", () => {
    it("includes PRs from the search API when myPRs is true", async () => {
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      (
        mockOctokit.search.issuesAndPullRequests as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        data: {
          items: [
            {
              number: 10,
              repository_url: "https://api.github.com/repos/other/lib",
            },
          ],
        },
      });
      const myPR = makePR({ number: 10, title: "My PR" });
      (mockOctokit.pulls.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: myPR,
      });
      stubEmptyActivity();

      const events: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        myPRs: true,
      });
      watcher.onNewPR((e) => events.push(e));
      await watcher.start();

      expect(events).toHaveLength(1);
      expect(events[0].repo).toEqual({ owner: "other", name: "lib" });
    });
  });

  describe("stop", () => {
    it("stops polling", async () => {
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      await watcher.start();

      const callCount = (mockOctokit.pulls.list as ReturnType<typeof vi.fn>)
        .mock.calls.length;
      watcher.stop();

      await vi.advanceTimersByTimeAsync(5000);
      expect(
        (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBe(callCount);
    });
  });
});
