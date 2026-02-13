import type {
  Label,
  MergeableState,
  PRUpdatedEvent,
  PullRequest,
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
}

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
  };
}

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
