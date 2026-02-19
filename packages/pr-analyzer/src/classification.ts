/**
 * PR Classification
 *
 * Classifies PRs into action buckets:
 *   - readyForHuman: PRs that need human attention (review, approve, merge)
 *   - needsBotBump: PRs waiting on a bot response
 *   - inProgress: PRs with active work (CI running, AI processing)
 *   - blocked: PRs waiting but no active work (draft, CI failed, conflicts)
 */

import type { PRStatus, ScannedPR, ScanResult } from "./types.js";

/**
 * Classify PRs into action buckets
 */
export function classifyPRs(prs: readonly ScannedPR[]): ScanResult {
  return {
    all: prs,
    readyForHuman: prs.filter(isReadyForHuman),
    needsBotBump: prs.filter(needsBotBump),
    inProgress: prs.filter(isInProgress),
    blocked: prs.filter(isBlocked),
  };
}

// --- Classification predicates ---

const READY_FOR_HUMAN_STATUSES: PRStatus[] = [
  "needs_human_review",
  "needs_review",
  "changes_requested",
  "approved",
  "ready_to_merge",
];

// In progress = something is actively working
const IN_PROGRESS_STATUSES: PRStatus[] = [
  "ci_running",
  "ai_processing",
  "ai_reviewing",
];

// Blocked = waiting but nothing actively working
const BLOCKED_STATUSES: PRStatus[] = ["draft", "ci_failed", "has_conflicts"];

function isReadyForHuman(pr: ScannedPR): boolean {
  return READY_FOR_HUMAN_STATUSES.includes(pr.status);
}

function needsBotBump(pr: ScannedPR): boolean {
  return pr.status === "waiting_on_bot";
}

function isInProgress(pr: ScannedPR): boolean {
  return IN_PROGRESS_STATUSES.includes(pr.status);
}

function isBlocked(pr: ScannedPR): boolean {
  return BLOCKED_STATUSES.includes(pr.status);
}
