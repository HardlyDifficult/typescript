/**
 * PR Classification
 *
 * Classifies PRs into action buckets:
 *   - readyForHuman: PRs that need human attention (review, approve, merge)
 *   - needsBotBump: PRs waiting on a bot response
 *   - inProgress: PRs with active work (CI running)
 *   - blocked: PRs waiting but no active work (draft, CI failed, conflicts)
 *
 * Consumers can extend buckets via ClassificationConfig.
 */

import type { ClassificationConfig, ScannedPR, ScanResult } from "./types.js";

// --- Core status lists ---

const READY_FOR_HUMAN_STATUSES: readonly string[] = [
  "needs_review",
  "changes_requested",
  "approved",
  "ready_to_merge",
];

const IN_PROGRESS_STATUSES: readonly string[] = ["ci_running"];

const BLOCKED_STATUSES: readonly string[] = [
  "draft",
  "ci_failed",
  "has_conflicts",
];

const NEEDS_BOT_BUMP_STATUSES: readonly string[] = ["waiting_on_bot"];

/**
 * Classify PRs into action buckets.
 *
 * @param prs - The PRs to classify
 * @param config - Optional extra statuses to include in each bucket
 */
export function classifyPRs(
  prs: readonly ScannedPR[],
  config?: ClassificationConfig
): ScanResult {
  const readyForHuman = mergeStatuses(
    READY_FOR_HUMAN_STATUSES,
    config?.readyForHuman
  );
  const inProgress = mergeStatuses(IN_PROGRESS_STATUSES, config?.inProgress);
  const blocked = mergeStatuses(BLOCKED_STATUSES, config?.blocked);
  const needsBotBump = mergeStatuses(
    NEEDS_BOT_BUMP_STATUSES,
    config?.needsBotBump
  );

  return {
    all: prs,
    readyForHuman: prs.filter((pr) => readyForHuman.includes(pr.status)),
    needsBotBump: prs.filter((pr) => needsBotBump.includes(pr.status)),
    inProgress: prs.filter((pr) => inProgress.includes(pr.status)),
    blocked: prs.filter((pr) => blocked.includes(pr.status)),
  };
}

function mergeStatuses(
  base: readonly string[],
  extra?: readonly string[]
): readonly string[] {
  if (!extra || extra.length === 0) {
    return base;
  }
  return [...base, ...extra];
}
