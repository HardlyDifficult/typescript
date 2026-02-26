import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PRWatcher } from "../src/PRWatcher.js";
import type {
  PREvent,
  PRUpdatedEvent,
  PRStatusEvent,
  PollCompleteEvent,
  CommentEvent,
  ReviewEvent,
  CheckRunEvent,
  StatusChangedEvent,
  PushEvent,
  PRWatcherEvent,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
  CheckRun,
  Label,
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
  repos: {
    get: vi.fn(),
  },
  git: {
    getRef: vi.fn(),
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

      const updatedPR = makePR({ updated_at: "2024-01-01T01:00:00Z" });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [updatedPR],
      });
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

      const updatedPR = makePR({ updated_at: "2024-01-01T01:00:00Z" });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [updatedPR],
      });
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

      const updatedPR = makePR({ updated_at: "2024-01-01T01:00:00Z" });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [updatedPR],
      });
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

  describe("onPRUpdated", () => {
    function makeLabel(overrides: Partial<Label> = {}): Label {
      return {
        id: 1,
        name: "bug",
        color: "d73a4a",
        description: null,
        ...overrides,
      };
    }

    it("fires when draft changes to ready", async () => {
      const pr = makePR({ draft: true });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PRUpdatedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPRUpdated((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(0);

      const readyPR = makePR({ draft: false });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [readyPR],
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].changes.draft).toEqual({ from: true, to: false });
    });

    it("fires when labels change", async () => {
      const pr = makePR({ labels: [] });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PRUpdatedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPRUpdated((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(0);

      const label = makeLabel({ id: 10, name: "enhancement" });
      const labeledPR = makePR({ labels: [label] });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [labeledPR],
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].changes.labels).toEqual({
        from: [],
        to: [label],
      });
    });

    it("fires when mergeable_state changes", async () => {
      const pr = makePR({ mergeable_state: "mergeable" });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PRUpdatedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPRUpdated((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(0);

      const conflictingPR = makePR({ mergeable_state: "conflicting" });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [conflictingPR],
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].changes.mergeable_state).toEqual({
        from: "mergeable",
        to: "conflicting",
      });
    });

    it("does not fire when metadata is unchanged", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PRUpdatedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPRUpdated((e) => events.push(e));
      await watcher.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(0);
    });

    it("does not fire on initial poll", async () => {
      const pr = makePR({ draft: true });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PRUpdatedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      watcher.onPRUpdated((e) => events.push(e));
      await watcher.start();

      expect(events).toHaveLength(0);
    });

    it("includes multiple changes in single event", async () => {
      const pr = makePR({ draft: true, labels: [] });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PRUpdatedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPRUpdated((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(0);

      const label = makeLabel({ id: 5, name: "urgent" });
      const updatedPR = makePR({ draft: false, labels: [label] });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [updatedPR],
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].changes.draft).toEqual({ from: true, to: false });
      expect(events[0].changes.labels).toEqual({ from: [], to: [label] });
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

  describe("onPollComplete", () => {
    it("fires after each poll with current tracked PRs", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PollCompleteEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPollComplete((e) => events.push(e));
      await watcher.start();

      expect(events).toHaveLength(1);
      expect(events[0].prs).toHaveLength(1);
      expect(events[0].prs[0].pr.number).toBe(42);
      expect(events[0].prs[0].repo).toEqual({ owner: "owner", name: "repo" });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(2);
      expect(events[1].prs).toHaveLength(1);
    });

    it("fires with empty array when no PRs are tracked", async () => {
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      stubEmptyActivity();

      const events: PollCompleteEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      watcher.onPollComplete((e) => events.push(e));
      await watcher.start();

      expect(events).toHaveLength(1);
      expect(events[0].prs).toHaveLength(0);
    });

    it("reflects PRs removed after merge", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PollCompleteEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPollComplete((e) => events.push(e));
      await watcher.start();

      expect(events[0].prs).toHaveLength(1);

      const mergedPR = makePR({
        state: "closed",
        merged_at: "2024-01-02T00:00:00Z",
        closed_at: "2024-01-02T00:00:00Z",
      });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [mergedPR],
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(events[1].prs).toHaveLength(0);
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

  describe("dynamic repos", () => {
    it("addRepo picks up PRs from new repo on next poll", async () => {
      const prFromOriginal = makePR({ number: 1 });
      const prFromNew = makePR({ number: 2, title: "New repo PR" });

      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockImplementation(
        (args: { owner: string; repo: string }) => {
          if (args.owner === "owner" && args.repo === "repo") {
            return Promise.resolve({ data: [prFromOriginal] });
          }
          if (args.owner === "other" && args.repo === "lib") {
            return Promise.resolve({ data: [prFromNew] });
          }
          return Promise.resolve({ data: [] });
        }
      );
      stubEmptyActivity();

      const events: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onNewPR((e) => events.push(e));
      await watcher.start();

      expect(events).toHaveLength(1);
      expect(events[0].pr.number).toBe(1);

      watcher.addRepo("other/lib");

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(2);
      expect(events[1].pr.number).toBe(2);
      expect(events[1].repo).toEqual({ owner: "other", name: "lib" });
    });

    it("removeRepo stops watching removed repo", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const newEvents: PREvent[] = [];
      const pollEvents: PollCompleteEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onNewPR((e) => newEvents.push(e));
      watcher.onPollComplete((e) => pollEvents.push(e));
      await watcher.start();

      expect(newEvents).toHaveLength(1);
      expect(pollEvents[0].prs).toHaveLength(1);

      watcher.removeRepo("owner/repo");

      const freshPR = makePR({
        state: "closed",
        merged_at: "2024-01-02T00:00:00Z",
      });
      (mockOctokit.pulls.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: freshPR,
      });

      await vi.advanceTimersByTimeAsync(1000);

      const lastPoll = pollEvents[pollEvents.length - 1];
      expect(lastPoll.prs).toHaveLength(0);
    });

    it("addRepo does not add duplicates", async () => {
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      await watcher.start();

      const callsBefore = (mockOctokit.pulls.list as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      watcher.addRepo("owner/repo");
      watcher.addRepo("owner/repo");

      await vi.advanceTimersByTimeAsync(1000);

      const callsAfter = (mockOctokit.pulls.list as ReturnType<typeof vi.fn>)
        .mock.calls.length;
      const callsDuringPoll = callsAfter - callsBefore;
      expect(callsDuringPoll).toBe(1);
    });
  });

  describe("getWatchedPRs", () => {
    it("returns empty array before start", () => {
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });

      const result = watcher.getWatchedPRs();
      expect(result).toEqual([]);
    });

    it("returns tracked PRs after start", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      await watcher.start();

      const result = watcher.getWatchedPRs();
      expect(result).toHaveLength(1);
      expect(result[0].pr.number).toBe(42);
      expect(result[0].repo).toEqual({ owner: "owner", name: "repo" });
    });

    it("reflects removals after merge", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      await watcher.start();

      expect(watcher.getWatchedPRs()).toHaveLength(1);

      const mergedPR = makePR({
        state: "closed",
        merged_at: "2024-01-02T00:00:00Z",
        closed_at: "2024-01-02T00:00:00Z",
      });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [mergedPR],
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(watcher.getWatchedPRs()).toHaveLength(0);
    });
  });

  describe("classifyPR", () => {
    it("calls classifyPR with PR event and activity data on new PR", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      const comment = makeComment({ id: 101 });
      stubActivity([comment], [], []);

      const classifyPR = vi.fn().mockReturnValue("needs_review");
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        classifyPR,
      });
      await watcher.start();

      expect(classifyPR).toHaveBeenCalledOnce();
      expect(classifyPR).toHaveBeenCalledWith(
        expect.objectContaining({
          pr,
          repo: { owner: "owner", name: "repo" },
        }),
        expect.objectContaining({
          comments: [comment],
          reviews: [],
          checkRuns: [],
        })
      );
    });

    it("returns initial statuses from start()", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        classifyPR: () => "approved",
      });
      const initial = await watcher.start();

      expect(initial).toHaveLength(1);
      expect(initial[0].status).toBe("approved");
      expect(initial[0].pr.number).toBe(42);
    });

    it("returns empty status when classifyPR is not provided", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      const initial = await watcher.start();

      expect(initial).toHaveLength(1);
      expect(initial[0].status).toBe("");
    });

    it("calls classifyPR on each poll for existing PRs", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const classifyPR = vi.fn().mockReturnValue("needs_review");
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        classifyPR,
      });
      await watcher.start();
      expect(classifyPR).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(classifyPR).toHaveBeenCalledTimes(2);
    });

    it("supports async classifyPR", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        classifyPR: async () => Promise.resolve("ci_running"),
      });
      const initial = await watcher.start();

      expect(initial[0].status).toBe("ci_running");
    });
  });

  describe("onStatusChanged", () => {
    it("fires when classifyPR returns a different status on subsequent poll", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      let callCount = 0;
      const classifyPR = () => {
        callCount++;
        return callCount === 1 ? "needs_review" : "approved";
      };

      const events: StatusChangedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        classifyPR,
      });
      watcher.onStatusChanged((e) => events.push(e));
      await watcher.start();

      expect(events).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].previousStatus).toBe("needs_review");
      expect(events[0].status).toBe("approved");
      expect(events[0].pr.number).toBe(42);
    });

    it("does not fire when status is unchanged", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: StatusChangedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        classifyPR: () => "needs_review",
      });
      watcher.onStatusChanged((e) => events.push(e));
      await watcher.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(0);
    });

    it("does not fire during first poll", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: StatusChangedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        classifyPR: () => "approved",
      });
      watcher.onStatusChanged((e) => events.push(e));
      await watcher.start();

      expect(events).toHaveLength(0);
    });

    it("fires for each status transition", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      let callCount = 0;
      const statuses = ["needs_review", "ci_running", "approved"];
      const classifyPR = () => {
        const status = statuses[callCount] ?? "approved";
        callCount++;
        return status;
      };

      const events: StatusChangedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        classifyPR,
      });
      watcher.onStatusChanged((e) => events.push(e));
      await watcher.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(1);
      expect(events[0].previousStatus).toBe("needs_review");
      expect(events[0].status).toBe("ci_running");

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(2);
      expect(events[1].previousStatus).toBe("ci_running");
      expect(events[1].status).toBe("approved");
    });

    it("unsubscribe removes callback", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      let callCount = 0;
      const classifyPR = () => {
        callCount++;
        return callCount === 1 ? "needs_review" : "approved";
      };

      const events: StatusChangedEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        classifyPR,
      });
      const unsub = watcher.onStatusChanged((e) => events.push(e));
      await watcher.start();

      unsub();
      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(0);
    });
  });

  describe("discoverRepos", () => {
    it("adds discovered repos to the watch list each poll", async () => {
      const prFromOriginal = makePR({ number: 1 });
      const prFromNew = makePR({ number: 2, title: "Discovered repo PR" });

      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockImplementation(
        (args: { owner: string; repo: string }) => {
          if (args.owner === "owner" && args.repo === "repo") {
            return Promise.resolve({ data: [prFromOriginal] });
          }
          if (args.owner === "discovered" && args.repo === "lib") {
            return Promise.resolve({ data: [prFromNew] });
          }
          return Promise.resolve({ data: [] });
        }
      );
      stubEmptyActivity();

      let discoverCallCount = 0;
      const discoverRepos = vi.fn().mockImplementation(() => {
        discoverCallCount++;
        return discoverCallCount >= 2 ? ["discovered/lib"] : [];
      });

      const newPREvents: PREvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        discoverRepos,
      });
      watcher.onNewPR((e) => newPREvents.push(e));
      await watcher.start();

      expect(newPREvents).toHaveLength(1);
      expect(newPREvents[0].pr.number).toBe(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(newPREvents).toHaveLength(2);
      expect(newPREvents[1].pr.number).toBe(2);
      expect(newPREvents[1].repo).toEqual({
        owner: "discovered",
        name: "lib",
      });
    });

    it("is called on every poll cycle", async () => {
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      stubEmptyActivity();

      const discoverRepos = vi.fn().mockResolvedValue([]);
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        discoverRepos,
      });
      await watcher.start();
      expect(discoverRepos).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(discoverRepos).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1000);
      expect(discoverRepos).toHaveBeenCalledTimes(3);
    });
  });

  describe("onPush", () => {
    function stubGetRef(sha: string): void {
      (mockOctokit.git.getRef as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { object: { sha } },
      });
    }

    it("does not fire on first poll (baseline establishment)", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();
      stubGetRef("aaa111");

      const events: PushEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      watcher.onPush((e) => events.push(e));
      await watcher.start();

      expect(events).toHaveLength(0);
      expect(mockOctokit.git.getRef).toHaveBeenCalledOnce();
    });

    it("fires when default branch HEAD changes", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();
      stubGetRef("aaa111");

      const events: PushEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPush((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(0);

      stubGetRef("bbb222");
      await vi.advanceTimersByTimeAsync(1000);

      expect(events).toHaveLength(1);
      expect(events[0].sha).toBe("bbb222");
      expect(events[0].previousSha).toBe("aaa111");
      expect(events[0].branch).toBe("main");
      expect(events[0].repo).toEqual({ owner: "owner", name: "repo" });
    });

    it("does not fire when HEAD is unchanged", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();
      stubGetRef("aaa111");

      const events: PushEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPush((e) => events.push(e));
      await watcher.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(events).toHaveLength(0);
    });

    it("harvests default branch name from PR data (no repos.get call)", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();
      stubGetRef("aaa111");

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      watcher.onPush(() => {});
      await watcher.start();

      expect(mockOctokit.repos.get).not.toHaveBeenCalled();
      expect(mockOctokit.git.getRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "heads/main" })
      );
    });

    it("falls back to repos.get when no open PRs", async () => {
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      stubEmptyActivity();
      (mockOctokit.repos.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { default_branch: "develop" },
      });
      stubGetRef("aaa111");

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      watcher.onPush(() => {});
      await watcher.start();

      expect(mockOctokit.repos.get).toHaveBeenCalledOnce();
      expect(mockOctokit.git.getRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "heads/develop" })
      );
    });

    it("caches repos.get result (only calls once across polls)", async () => {
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      stubEmptyActivity();
      (mockOctokit.repos.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { default_branch: "develop" },
      });
      stubGetRef("aaa111");

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPush(() => {});
      await watcher.start();
      expect(mockOctokit.repos.get).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockOctokit.repos.get).toHaveBeenCalledOnce();
    });

    it("routes errors through onError (not silent catch)", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();
      (mockOctokit.git.getRef as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API rate limit")
      );

      const errors: Error[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      watcher.onPush(() => {});
      watcher.onError((e) => errors.push(e));
      await watcher.start();

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("API rate limit");
    });

    it("does not make API calls when no onPush listeners", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      await watcher.start();

      expect(mockOctokit.git.getRef).not.toHaveBeenCalled();
      expect(mockOctokit.repos.get).not.toHaveBeenCalled();
    });

    it("unsubscribe removes callback", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();
      stubGetRef("aaa111");

      const events: PushEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      const unsub = watcher.onPush((e) => events.push(e));
      await watcher.start();

      unsub();
      stubGetRef("bbb222");
      await vi.advanceTimersByTimeAsync(1000);

      expect(events).toHaveLength(0);
    });

    it("works with multiple repos", async () => {
      const pr1 = makePR({ number: 1 });
      const pr2 = makePR({
        number: 2,
        base: {
          ref: "main",
          sha: "def456",
          repo: {
            id: 2,
            name: "lib",
            full_name: "other/lib",
            owner: { login: "other", id: 2 },
            html_url: "",
            default_branch: "main",
            description: null,
          },
        },
      });

      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockImplementation(
        (args: { owner: string; repo: string }) => {
          if (args.owner === "owner" && args.repo === "repo") {
            return Promise.resolve({ data: [pr1] });
          }
          if (args.owner === "other" && args.repo === "lib") {
            return Promise.resolve({ data: [pr2] });
          }
          return Promise.resolve({ data: [] });
        }
      );
      stubEmptyActivity();
      stubGetRef("aaa111");

      const events: PushEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo", "other/lib"],
        intervalMs: 1000,
      });
      watcher.onPush((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(0);

      stubGetRef("bbb222");
      await vi.advanceTimersByTimeAsync(1000);

      expect(events).toHaveLength(2);
      const repos = events.map((e) => `${e.repo.owner}/${e.repo.name}`);
      expect(repos).toContain("owner/repo");
      expect(repos).toContain("other/lib");
    });

    it("cleanup on removeRepo prevents stale events", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();
      stubGetRef("aaa111");

      const events: PushEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPush((e) => events.push(e));
      await watcher.start();
      expect(events).toHaveLength(0);

      // Remove and re-add the repo
      watcher.removeRepo("owner/repo");

      // Simulate PR disappearing too
      (mockOctokit.pulls.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: makePR({ state: "closed", merged_at: "2024-01-02T00:00:00Z" }),
      });

      watcher.addRepo("owner/repo");

      // SHA changed, but since we removed+re-added, this is a new baseline
      stubGetRef("bbb222");
      await vi.advanceTimersByTimeAsync(1000);

      // No push event because re-add establishes new baseline
      expect(events).toHaveLength(0);
    });

    it("fires push events even when PR processing throws", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();
      stubGetRef("aaa111");

      const pushEvents: PushEvent[] = [];
      const errors: Error[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onPush((e) => pushEvents.push(e));
      watcher.onError((e) => errors.push(e));
      await watcher.start();

      // Second poll: PR processing fails, but push detection should still work
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API rate limit")
      );
      stubGetRef("bbb222");

      await vi.advanceTimersByTimeAsync(1000);

      // Push event fires despite PR processing failure
      expect(pushEvents).toHaveLength(1);
      expect(pushEvents[0].sha).toBe("bbb222");
      expect(pushEvents[0].previousSha).toBe("aaa111");

      // PR error was still reported
      expect(errors.some((e) => e.message === "API rate limit")).toBe(true);
    });
  });

  describe("stalePRThresholdMs", () => {
    it("removes snapshots older than threshold", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const pollEvents: PollCompleteEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        stalePRThresholdMs: 5000,
      });
      watcher.onPollComplete((e) => pollEvents.push(e));
      await watcher.start();
      expect(pollEvents[0].prs).toHaveLength(1);

      // PR disappears from the list but isn't merged/closed
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });
      // Mock the pulls.get call for removed PR detection
      (mockOctokit.pulls.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: makePR({ state: "open" }),
      });

      // Advance past the stale threshold
      vi.setSystemTime(Date.now() + 6000);
      await vi.advanceTimersByTimeAsync(1000);

      const lastPoll = pollEvents[pollEvents.length - 1];
      expect(lastPoll.prs).toHaveLength(0);
    });

    it("does not remove snapshots within threshold", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const pollEvents: PollCompleteEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        stalePRThresholdMs: 60000,
      });
      watcher.onPollComplete((e) => pollEvents.push(e));
      await watcher.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(pollEvents[pollEvents.length - 1].prs).toHaveLength(1);
    });
  });

  describe("selective activity fetching", () => {
    it("skips API calls when updated_at and head.sha are unchanged and checks are complete", async () => {
      const pr = makePR();
      const checkRun = makeCheckRun({
        id: 301,
        status: "completed",
        conclusion: "success",
      });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubActivity([], [], [checkRun]);

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      await watcher.start();

      // Clear call counts after initial poll
      vi.clearAllMocks();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      (
        mockOctokit.search.issuesAndPullRequests as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ data: { items: [] } });

      await vi.advanceTimersByTimeAsync(1000);

      // Activity endpoints should NOT be called since PR is unchanged
      expect(mockOctokit.issues.listComments).not.toHaveBeenCalled();
      expect(
        (mockOctokit.pulls as { listReviews?: ReturnType<typeof vi.fn> })
          .listReviews
      ).not.toHaveBeenCalled();
      expect(mockOctokit.checks.listForRef).not.toHaveBeenCalled();
    });

    it("fetches only check runs when updated_at is unchanged but checks are incomplete", async () => {
      const pr = makePR();
      const incompleteCheck = makeCheckRun({
        id: 301,
        status: "in_progress",
        conclusion: null,
      });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubActivity([], [], [incompleteCheck]);

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      await watcher.start();

      // Clear call counts after initial poll
      vi.clearAllMocks();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      (
        mockOctokit.search.issuesAndPullRequests as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ data: { items: [] } });
      const completedCheck = makeCheckRun({
        id: 301,
        status: "completed",
        conclusion: "success",
      });
      (
        mockOctokit.checks.listForRef as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        data: { check_runs: [completedCheck] },
      });

      const events: CheckRunEvent[] = [];
      watcher.onCheckRun((e) => events.push(e));

      await vi.advanceTimersByTimeAsync(1000);

      // Only check runs should be fetched
      expect(mockOctokit.issues.listComments).not.toHaveBeenCalled();
      expect(mockOctokit.checks.listForRef).toHaveBeenCalledOnce();
      // Check run status change should still be detected
      expect(events).toHaveLength(1);
      expect(events[0].checkRun.status).toBe("completed");
    });

    it("fetches all activity when updated_at changes", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      await watcher.start();

      // Clear call counts after initial poll
      vi.clearAllMocks();
      const updatedPR = makePR({ updated_at: "2024-01-01T01:00:00Z" });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [updatedPR],
      });
      (
        mockOctokit.search.issuesAndPullRequests as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ data: { items: [] } });
      stubEmptyActivity();

      await vi.advanceTimersByTimeAsync(1000);

      // All activity endpoints should be called
      expect(mockOctokit.issues.listComments).toHaveBeenCalledOnce();
      expect(mockOctokit.checks.listForRef).toHaveBeenCalledOnce();
    });

    it("fetches all activity when head.sha changes", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      await watcher.start();

      // Clear call counts after initial poll
      vi.clearAllMocks();
      const newSHAPR = makePR({
        head: { ref: "feature", sha: "newsha456", repo: null },
      });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [newSHAPR],
      });
      (
        mockOctokit.search.issuesAndPullRequests as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ data: { items: [] } });
      stubEmptyActivity();

      await vi.advanceTimersByTimeAsync(1000);

      // All activity endpoints should be called since head.sha changed
      expect(mockOctokit.issues.listComments).toHaveBeenCalledOnce();
      expect(mockOctokit.checks.listForRef).toHaveBeenCalledOnce();
    });
  });

  describe("throttle", () => {
    it("calls throttle.wait before API calls", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const mockThrottle = { wait: vi.fn().mockResolvedValue(undefined) };
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        throttle: mockThrottle,
      });
      await watcher.start();

      // throttle.wait should have been called for:
      // 1. pulls.list (weight 1 in fetchWatchedPRs)
      // 2. fetchPRActivity full fetch (weight 3)
      expect(mockThrottle.wait).toHaveBeenCalled();
      const weights = mockThrottle.wait.mock.calls.map(
        (call: unknown[]) => call[0] as number
      );
      expect(weights).toContain(1); // pulls.list
      expect(weights).toContain(3); // full activity fetch
    });

    it("calls throttle.wait with weight 0 when activity is cached", async () => {
      const pr = makePR();
      const checkRun = makeCheckRun({ id: 301 });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubActivity([], [], [checkRun]);

      const mockThrottle = { wait: vi.fn().mockResolvedValue(undefined) };
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        throttle: mockThrottle,
      });
      await watcher.start();

      mockThrottle.wait.mockClear();

      await vi.advanceTimersByTimeAsync(1000);

      // On second poll with unchanged PR: pulls.list (1) + cache hit (no wait call for 0)
      const weights = mockThrottle.wait.mock.calls.map(
        (call: unknown[]) => call[0] as number
      );
      expect(weights).toContain(1); // pulls.list
      expect(weights).not.toContain(3); // no full fetch
    });

    it("calls throttle.wait for removed PR lookup", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const mockThrottle = { wait: vi.fn().mockResolvedValue(undefined) };
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
        throttle: mockThrottle,
      });
      await watcher.start();

      // PR disappears from list
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

      mockThrottle.wait.mockClear();

      await vi.advanceTimersByTimeAsync(1000);

      // Should have throttle calls including weight 1 for pulls.get
      const weights = mockThrottle.wait.mock.calls.map(
        (call: unknown[]) => call[0] as number
      );
      expect(
        weights.filter((w: number) => w === 1).length
      ).toBeGreaterThanOrEqual(2);
    });
  });

  describe("onEvent", () => {
    it("emits discriminated union events in sync with onX listeners", async () => {
      const pr = makePR();
      const comment = makeComment();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubActivity([], [], []);

      const unionEvents: PRWatcherEvent[] = [];
      const newPREvents: PREvent[] = [];
      const commentEvents: CommentEvent[] = [];

      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
        intervalMs: 1000,
      });
      watcher.onEvent((event) => unionEvents.push(event));
      watcher.onNewPR((event) => newPREvents.push(event));
      watcher.onComment((event) => commentEvents.push(event));

      await watcher.start();
      expect(unionEvents.map((event) => event.type)).toContain("new_pr");
      expect(newPREvents).toHaveLength(1);

      const updatedPR = makePR({ updated_at: "2024-01-01T00:05:00Z" });
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [updatedPR],
      });
      stubActivity([comment], [], []);
      await vi.advanceTimersByTimeAsync(1000);

      const commentUnionEvent = unionEvents.find(
        (event) => event.type === "comment"
      );
      expect(commentUnionEvent).toBeDefined();
      expect(commentEvents).toHaveLength(1);

      if (!commentUnionEvent || commentUnionEvent.type !== "comment") {
        throw new Error("Expected comment event");
      }

      expect(commentUnionEvent.payload).toEqual(commentEvents[0]);
    });

    it("supports unsubscribing from onEvent callbacks", async () => {
      const pr = makePR();
      (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [pr],
      });
      stubEmptyActivity();

      const events: PRWatcherEvent[] = [];
      watcher = new PRWatcher(mockOctokit, "testuser", {
        repos: ["owner/repo"],
      });
      const unsub = watcher.onEvent((event) => events.push(event));
      unsub();

      await watcher.start();
      expect(events).toHaveLength(0);
    });
  });
});

describe("repo normalization", () => {
  it("normalizes repository URLs passed in options", async () => {
    const pr = makePR();
    (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [pr],
    });
    stubEmptyActivity();

    const localWatcher = new PRWatcher(mockOctokit, "testuser", {
      repos: ["https://github.com/owner/repo/pull/42"],
    });

    await localWatcher.start();

    expect(mockOctokit.pulls.list).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "owner", repo: "repo" })
    );

    localWatcher.stop();
  });

  it("normalizes addRepo/removeRepo inputs", async () => {
    const pr = makePR();
    (mockOctokit.pulls.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [pr],
    });
    stubEmptyActivity();

    const localWatcher = new PRWatcher(mockOctokit, "testuser", {
      repos: ["owner/repo"],
    });
    localWatcher.addRepo("github.com/owner/repo");
    localWatcher.removeRepo("https://github.com/owner/repo");

    await localWatcher.start();

    expect(mockOctokit.pulls.list).not.toHaveBeenCalled();

    localWatcher.stop();
  });
});
