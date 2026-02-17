import type {
  CheckRun,
  Label,
  MergeableState,
  PRUpdatedEvent,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
} from "../types.js";

import type { PRActivity } from "./fetchPRActivity.js";

export interface PRSnapshot {
  pr: PullRequest;
  owner: string;
  name: string;
  commentIds: Set<number>;
  reviewIds: Set<number>;
  checkRuns: Map<number, { status: string; conclusion: string | null }>;
  status: string | null;
  lastSeen: number;
  updatedAt: string;
  headSha: string;
  hasIncompleteChecks: boolean;
  cachedActivity: PRActivity;
}

/** Creates a point-in-time snapshot of a PR's state including activity IDs for change detection. */
export function buildSnapshot(
  pr: PullRequest,
  owner: string,
  name: string,
  activity: PRActivity,
  status: string | null
): PRSnapshot {
  return {
    pr,
    owner,
    name,
    commentIds: new Set(activity.comments.map((c) => c.id)),
    reviewIds: new Set(activity.reviews.map((r) => r.id)),
    checkRuns: new Map(
      activity.checkRuns.map((cr) => [
        cr.id,
        { status: cr.status, conclusion: cr.conclusion },
      ])
    ),
    status,
    lastSeen: Date.now(),
    updatedAt: pr.updated_at,
    headSha: pr.head.sha,
    hasIncompleteChecks: activity.checkRuns.some(
      (cr) => cr.status !== "completed"
    ),
    cachedActivity: activity,
  };
}

/** Compares two PR states and returns an event describing changes to draft status, mergeable state, or labels. */
export function detectPRChanges(
  current: PullRequest,
  previous: PullRequest,
  repo: { owner: string; name: string }
): PRUpdatedEvent | null {
  const changes: PRUpdatedEvent["changes"] = {};
  let hasChanges = false;

  if (current.draft !== previous.draft) {
    (changes as { draft: { from: boolean; to: boolean } }).draft = {
      from: previous.draft,
      to: current.draft,
    };
    hasChanges = true;
  }

  if (current.mergeable_state !== previous.mergeable_state) {
    (
      changes as {
        mergeable_state: { from: MergeableState; to: MergeableState };
      }
    ).mergeable_state = {
      from: previous.mergeable_state,
      to: current.mergeable_state,
    };
    hasChanges = true;
  }

  const prevLabels = previous.labels
    .map((l: Label) => l.id)
    .sort()
    .join(",");
  const currLabels = current.labels
    .map((l: Label) => l.id)
    .sort()
    .join(",");
  if (prevLabels !== currLabels) {
    (
      changes as {
        labels: { from: readonly Label[]; to: readonly Label[] };
      }
    ).labels = {
      from: previous.labels,
      to: current.labels,
    };
    hasChanges = true;
  }

  return hasChanges ? { pr: current, repo, changes } : null;
}

/** Returns comments that are new since the previous snapshot. */
export function detectNewComments(
  comments: readonly PullRequestComment[],
  previous: PRSnapshot
): readonly PullRequestComment[] {
  return comments.filter((c) => !previous.commentIds.has(c.id));
}

/** Returns reviews that are new since the previous snapshot. */
export function detectNewReviews(
  reviews: readonly PullRequestReview[],
  previous: PRSnapshot
): readonly PullRequestReview[] {
  return reviews.filter((r) => !previous.reviewIds.has(r.id));
}

/** Returns check runs whose status or conclusion changed since the previous snapshot. */
export function detectCheckRunChanges(
  checkRuns: readonly CheckRun[],
  previous: PRSnapshot
): readonly CheckRun[] {
  return checkRuns.filter((cr) => {
    const prev = previous.checkRuns.get(cr.id);
    return prev?.status !== cr.status || prev.conclusion !== cr.conclusion;
  });
}
