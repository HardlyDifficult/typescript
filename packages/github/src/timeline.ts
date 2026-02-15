/**
 * PR Timeline Builder
 *
 * Merges PR comments, reviews, and commits into a single chronologically
 * sorted timeline — the same view you'd see on the GitHub PR page.
 */

import type {
  PullRequestComment,
  PullRequestCommit,
  PullRequestReview,
} from "./types.js";

export type TimelineEntryKind = "comment" | "review" | "commit";

export interface TimelineEntry {
  readonly kind: TimelineEntryKind;
  readonly timestamp: string;
  readonly author: string;
  readonly body: string;
  readonly reviewState?: string;
  readonly commitSha?: string;
}

/**
 * Build a unified timeline from PR comments, reviews, and commits.
 * Entries are sorted chronologically (oldest first).
 */
export function buildTimeline(
  comments: readonly PullRequestComment[],
  reviews: readonly PullRequestReview[],
  commits: readonly PullRequestCommit[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const c of comments) {
    entries.push({
      kind: "comment",
      timestamp: c.created_at,
      author: c.user.login,
      body: c.body,
    });
  }

  for (const r of reviews) {
    entries.push({
      kind: "review",
      timestamp: r.submitted_at,
      author: r.user.login,
      body: r.body,
      reviewState: r.state,
    });
  }

  for (const c of commits) {
    entries.push({
      kind: "commit",
      timestamp: c.commit.author.date,
      author: c.author?.login ?? c.commit.author.name,
      body: c.commit.message,
      commitSha: c.sha.slice(0, 7),
    });
  }

  entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return entries;
}

/** Icon for each timeline entry kind */
const KIND_ICON: Record<TimelineEntryKind, string> = {
  comment: "\u{1F4AC}",
  review: "\u{2705}",
  commit: "\u{1F4DD}",
};

/** Format a review state for display */
function formatReviewState(state: string): string {
  switch (state) {
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changes requested";
    case "COMMENTED":
      return "commented";
    case "DISMISSED":
      return "dismissed";
    default:
      return state.toLowerCase();
  }
}

/**
 * Format a timeline as readable markdown text.
 *
 * Example output:
 *   [2024-01-15 10:30] 💬 @alice (comment): Looks good but fix the import
 *   [2024-01-15 11:00] 📝 @bob (commit abc123): Fix import order
 *   [2024-01-15 11:30] ✅ @alice (review: approved): LGTM
 */
export function formatTimeline(entries: readonly TimelineEntry[]): string {
  if (entries.length === 0) {
    return "No activity.";
  }

  return entries
    .map((e) => {
      const date = new Date(e.timestamp);
      const ts = `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`;
      const icon = KIND_ICON[e.kind];

      let label: string;
      switch (e.kind) {
        case "comment":
          label = "comment";
          break;
        case "review":
          label = `review: ${formatReviewState(e.reviewState ?? "COMMENTED")}`;
          break;
        case "commit":
          label = `commit ${e.commitSha ?? ""}`;
          break;
        default:
          label = e.kind;
          break;
      }

      // Truncate long bodies to keep the timeline scannable
      const body = e.body.length > 500 ? `${e.body.slice(0, 497)}...` : e.body;
      // Collapse multi-line bodies to a single line for the timeline view
      const oneLine = body.replace(/\n/g, " ").trim();

      return `[${ts}] ${icon} @${e.author} (${label}): ${oneLine}`;
    })
    .join("\n");
}
