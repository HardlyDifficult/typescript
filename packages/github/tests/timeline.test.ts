import { describe, it, expect } from "vitest";
import { buildTimeline, formatTimeline } from "../src/timeline.js";
import type {
  PullRequestComment,
  PullRequestReview,
  PullRequestCommit,
} from "../src/types.js";

// --- Fixture helpers ---

function makeComment(
  overrides: Partial<PullRequestComment> & { id: number }
): PullRequestComment {
  return {
    id: overrides.id,
    user: overrides.user ?? {
      login: "alice",
      id: 1,
      avatar_url: "",
      html_url: "",
    },
    body: overrides.body ?? "A comment",
    created_at: overrides.created_at ?? "2024-01-15T10:00:00Z",
    updated_at: overrides.updated_at ?? "2024-01-15T10:00:00Z",
    html_url: overrides.html_url ?? "",
  };
}

function makeReview(
  overrides: Partial<PullRequestReview> & { id: number }
): PullRequestReview {
  return {
    id: overrides.id,
    user: overrides.user ?? {
      login: "bob",
      id: 2,
      avatar_url: "",
      html_url: "",
    },
    body: overrides.body ?? "Review body",
    state: overrides.state ?? "APPROVED",
    submitted_at: overrides.submitted_at ?? "2024-01-15T11:00:00Z",
    html_url: overrides.html_url ?? "",
  };
}

function makeCommit(
  sha: string,
  overrides: {
    date?: string;
    message?: string;
    authorLogin?: string | null;
    authorName?: string;
  } = {}
): PullRequestCommit {
  return {
    sha,
    commit: {
      author: {
        name: overrides.authorName ?? "Charlie",
        email: "charlie@example.com",
        date: overrides.date ?? "2024-01-15T09:00:00Z",
      },
      message: overrides.message ?? "Fix bug",
    },
    author:
      overrides.authorLogin === null
        ? null
        : {
            login: overrides.authorLogin ?? "charlie",
            id: 3,
            avatar_url: "",
            html_url: "",
          },
    html_url: "",
  };
}

// --- buildTimeline tests ---

describe("buildTimeline", () => {
  it("returns empty array when all inputs are empty", () => {
    const result = buildTimeline([], [], []);
    expect(result).toEqual([]);
  });

  it("maps a single comment to a timeline entry", () => {
    const comment = makeComment({ id: 1, body: "Looks good to me" });
    const [entry] = buildTimeline([comment], [], []);

    expect(entry.kind).toBe("comment");
    expect(entry.author).toBe("alice");
    expect(entry.body).toBe("Looks good to me");
    expect(entry.timestamp).toBe("2024-01-15T10:00:00Z");
    expect(entry.reviewState).toBeUndefined();
    expect(entry.commitSha).toBeUndefined();
  });

  it("maps a single review to a timeline entry", () => {
    const review = makeReview({ id: 1, body: "LGTM", state: "APPROVED" });
    const [entry] = buildTimeline([], [review], []);

    expect(entry.kind).toBe("review");
    expect(entry.author).toBe("bob");
    expect(entry.body).toBe("LGTM");
    expect(entry.reviewState).toBe("APPROVED");
    expect(entry.commitSha).toBeUndefined();
  });

  it("maps a single commit to a timeline entry", () => {
    const commit = makeCommit("abc1234567890", { message: "Add feature" });
    const [entry] = buildTimeline([], [], [commit]);

    expect(entry.kind).toBe("commit");
    expect(entry.author).toBe("charlie");
    expect(entry.body).toBe("Add feature");
    expect(entry.commitSha).toBe("abc1234"); // first 7 chars
    expect(entry.reviewState).toBeUndefined();
  });

  it("uses commit.author.name when author (User) is null", () => {
    const commit = makeCommit("deadbeef000", {
      authorLogin: null,
      authorName: "Some Bot",
    });
    const [entry] = buildTimeline([], [], [commit]);

    expect(entry.author).toBe("Some Bot");
  });

  it("prefers GitHub login over commit author name", () => {
    const commit = makeCommit("feedface111", {
      authorLogin: "github-user",
      authorName: "Git User",
    });
    const [entry] = buildTimeline([], [], [commit]);

    expect(entry.author).toBe("github-user");
  });

  it("sorts entries chronologically (oldest first)", () => {
    const comment = makeComment({ id: 1, created_at: "2024-01-15T12:00:00Z" });
    const review = makeReview({
      id: 1,
      submitted_at: "2024-01-15T11:00:00Z",
      state: "APPROVED",
    });
    const commit = makeCommit("abc0000001", { date: "2024-01-15T09:00:00Z" });

    const result = buildTimeline([comment], [review], [commit]);

    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe("commit"); // 09:00
    expect(result[1].kind).toBe("review"); // 11:00
    expect(result[2].kind).toBe("comment"); // 12:00
  });

  it("handles multiple events of each type sorted together", () => {
    const comments = [
      makeComment({ id: 1, created_at: "2024-01-15T10:00:00Z" }),
      makeComment({ id: 2, created_at: "2024-01-15T14:00:00Z" }),
    ];
    const reviews = [
      makeReview({ id: 1, submitted_at: "2024-01-15T11:00:00Z" }),
      makeReview({ id: 2, submitted_at: "2024-01-15T13:00:00Z" }),
    ];
    const commits = [
      makeCommit("sha0000001", { date: "2024-01-15T09:00:00Z" }),
      makeCommit("sha0000002", { date: "2024-01-15T12:00:00Z" }),
    ];

    const result = buildTimeline(comments, reviews, commits);

    expect(result).toHaveLength(6);
    const timestamps = result.map((e) => e.timestamp);
    expect(timestamps).toEqual([
      "2024-01-15T09:00:00Z", // commit 1
      "2024-01-15T10:00:00Z", // comment 1
      "2024-01-15T11:00:00Z", // review 1
      "2024-01-15T12:00:00Z", // commit 2
      "2024-01-15T13:00:00Z", // review 2
      "2024-01-15T14:00:00Z", // comment 2
    ]);
  });

  it("preserves all review states (CHANGES_REQUESTED, COMMENTED, DISMISSED)", () => {
    const reviews = [
      makeReview({
        id: 1,
        state: "CHANGES_REQUESTED",
        submitted_at: "2024-01-15T10:00:00Z",
      }),
      makeReview({
        id: 2,
        state: "COMMENTED",
        submitted_at: "2024-01-15T11:00:00Z",
      }),
      makeReview({
        id: 3,
        state: "DISMISSED",
        submitted_at: "2024-01-15T12:00:00Z",
      }),
    ];

    const result = buildTimeline([], reviews, []);

    expect(result[0].reviewState).toBe("CHANGES_REQUESTED");
    expect(result[1].reviewState).toBe("COMMENTED");
    expect(result[2].reviewState).toBe("DISMISSED");
  });

  it("truncates commit SHA to 7 characters", () => {
    const commit = makeCommit("abcdef1234567890");
    const [entry] = buildTimeline([], [], [commit]);

    expect(entry.commitSha).toBe("abcdef1");
    expect(entry.commitSha?.length).toBe(7);
  });

  it("is stable for entries with identical timestamps (all entries present)", () => {
    const ts = "2024-01-15T10:00:00Z";
    const comment = makeComment({ id: 1, created_at: ts });
    const review = makeReview({ id: 1, submitted_at: ts, state: "APPROVED" });
    const commit = makeCommit("aaaa0000001", { date: ts });

    const result = buildTimeline([comment], [review], [commit]);
    expect(result).toHaveLength(3);
  });

  it("returns readonly-compatible array (does not mutate inputs)", () => {
    const comments = Object.freeze([
      makeComment({ id: 1 }),
    ]) as readonly PullRequestComment[];
    const reviews = Object.freeze([
      makeReview({ id: 1 }),
    ]) as readonly PullRequestReview[];
    const commits = Object.freeze([
      makeCommit("abc0000001"),
    ]) as readonly PullRequestCommit[];

    // Should not throw even with frozen arrays
    expect(() => buildTimeline(comments, reviews, commits)).not.toThrow();
  });
});

// --- formatTimeline tests ---

describe("formatTimeline", () => {
  it('returns "No activity." for an empty timeline', () => {
    const result = formatTimeline([]);
    expect(result).toBe("No activity.");
  });

  it("formats a comment entry correctly", () => {
    const comment = makeComment({
      id: 1,
      body: "Looks good to me",
      created_at: "2024-01-15T10:30:00Z",
    });
    const entries = buildTimeline([comment], [], []);
    const line = formatTimeline(entries);

    expect(line).toContain("@alice");
    expect(line).toContain("comment");
    expect(line).toContain("Looks good to me");
    expect(line).toContain("2024-01-15 10:30");
    expect(line).toContain("\u{1F4AC}"); // 💬
  });

  it("formats a review entry with APPROVED state", () => {
    const review = makeReview({
      id: 1,
      body: "Ship it",
      state: "APPROVED",
      submitted_at: "2024-01-15T11:00:00Z",
    });
    const entries = buildTimeline([], [review], []);
    const line = formatTimeline(entries);

    expect(line).toContain("@bob");
    expect(line).toContain("review: approved");
    expect(line).toContain("Ship it");
    expect(line).toContain("\u{2705}"); // ✅
  });

  it("formats a review entry with CHANGES_REQUESTED state", () => {
    const review = makeReview({
      id: 1,
      state: "CHANGES_REQUESTED",
      submitted_at: "2024-01-15T11:00:00Z",
    });
    const entries = buildTimeline([], [review], []);
    const line = formatTimeline(entries);

    expect(line).toContain("review: changes requested");
  });

  it("formats a review entry with COMMENTED state", () => {
    const review = makeReview({
      id: 1,
      state: "COMMENTED",
      submitted_at: "2024-01-15T11:00:00Z",
    });
    const entries = buildTimeline([], [review], []);
    const line = formatTimeline(entries);

    expect(line).toContain("review: commented");
  });

  it("formats a review entry with DISMISSED state", () => {
    const review = makeReview({
      id: 1,
      state: "DISMISSED",
      submitted_at: "2024-01-15T11:00:00Z",
    });
    const entries = buildTimeline([], [review], []);
    const line = formatTimeline(entries);

    expect(line).toContain("review: dismissed");
  });

  it("formats a commit entry correctly", () => {
    const commit = makeCommit("abcdef1234567890", {
      message: "Fix import order",
      date: "2024-01-15T11:00:00Z",
    });
    const entries = buildTimeline([], [], [commit]);
    const line = formatTimeline(entries);

    expect(line).toContain("@charlie");
    expect(line).toContain("commit abcdef1");
    expect(line).toContain("Fix import order");
    expect(line).toContain("2024-01-15 11:00");
    expect(line).toContain("\u{1F4DD}"); // 📝
  });

  it("produces one line per entry joined by newlines", () => {
    const comment = makeComment({ id: 1, created_at: "2024-01-15T10:00:00Z" });
    const review = makeReview({ id: 1, submitted_at: "2024-01-15T11:00:00Z" });
    const commit = makeCommit("abc0000001", { date: "2024-01-15T12:00:00Z" });
    const entries = buildTimeline([comment], [review], [commit]);

    const lines = formatTimeline(entries).split("\n");
    expect(lines).toHaveLength(3);
  });

  it("collapses multi-line bodies to a single line", () => {
    const comment = makeComment({
      id: 1,
      body: "Line one\nLine two\nLine three",
    });
    const entries = buildTimeline([comment], [], []);
    const line = formatTimeline(entries);

    expect(line).not.toContain("\n");
    expect(line).toContain("Line one Line two Line three");
  });

  it("truncates bodies longer than 500 characters", () => {
    const longBody = "a".repeat(600);
    const comment = makeComment({ id: 1, body: longBody });
    const entries = buildTimeline([comment], [], []);
    const line = formatTimeline(entries);

    expect(line).toContain("...");
    // The body portion should be at most 500 chars (497 + "...")
    const bodyPart = line.split("): ")[1];
    expect(bodyPart?.length).toBeLessThanOrEqual(500);
  });

  it("does not truncate bodies of exactly 500 characters", () => {
    const body = "b".repeat(500);
    const comment = makeComment({ id: 1, body });
    const entries = buildTimeline([comment], [], []);
    const line = formatTimeline(entries);

    expect(line).not.toContain("...");
  });

  it("formats the timestamp as UTC (YYYY-MM-DD HH:MM)", () => {
    const comment = makeComment({
      id: 1,
      created_at: "2024-06-20T15:45:30Z",
    });
    const entries = buildTimeline([comment], [], []);
    const line = formatTimeline(entries);

    // Must include the date and time portion
    expect(line).toContain("[2024-06-20 15:45]");
  });

  it("includes the author prefixed with @", () => {
    const comment = makeComment({ id: 1 });
    const entries = buildTimeline([comment], [], []);
    const line = formatTimeline(entries);

    expect(line).toMatch(/@alice/);
  });

  it("renders a full mixed timeline in chronological order", () => {
    const comment = makeComment({
      id: 1,
      body: "Please fix the import",
      created_at: "2024-01-15T10:30:00Z",
    });
    const commit = makeCommit("abc1234567890", {
      message: "Fix import order",
      date: "2024-01-15T11:00:00Z",
    });
    const review = makeReview({
      id: 1,
      body: "LGTM",
      state: "APPROVED",
      submitted_at: "2024-01-15T11:30:00Z",
    });

    const entries = buildTimeline([comment], [review], [commit]);
    const output = formatTimeline(entries);
    const lines = output.split("\n");

    expect(lines[0]).toContain("comment");
    expect(lines[0]).toContain("Please fix the import");
    expect(lines[1]).toContain("commit abc1234");
    expect(lines[1]).toContain("Fix import order");
    expect(lines[2]).toContain("review: approved");
    expect(lines[2]).toContain("LGTM");
  });
});
