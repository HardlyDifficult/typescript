/**
 * PR Analysis Types
 */

import type { PullRequest, Repository } from "@hardlydifficult/github";

/**
 * Possible statuses for a PR
 */
export type PRStatus =
  | "draft"
  | "ci_running"
  | "ci_failed"
  | "ai_processing"
  | "ai_reviewing"
  | "needs_review"
  | "needs_human_review"
  | "changes_requested"
  | "approved"
  | "has_conflicts"
  | "ready_to_merge"
  | "waiting_on_bot";

/**
 * A PR that has been scanned and analyzed
 */
export interface ScannedPR {
  readonly pr: PullRequest;
  readonly repo: Repository;
  readonly status: PRStatus;
  readonly ciStatus: CIStatus;
  readonly ciSummary: string;
  readonly hasConflicts: boolean;
  readonly waitingOnBot: boolean;
  readonly daysSinceUpdate: number;
}

/**
 * Result of scanning all PRs, classified into buckets
 */
export interface ScanResult {
  readonly all: readonly ScannedPR[];
  readonly readyForHuman: readonly ScannedPR[];
  readonly needsBotBump: readonly ScannedPR[];
  readonly inProgress: readonly ScannedPR[];
  readonly blocked: readonly ScannedPR[];
}

/**
 * CI status analysis result
 */
export interface CIStatus {
  readonly isRunning: boolean;
  readonly hasFailed: boolean;
  readonly allPassed: boolean;
  readonly summary: string;
}

/**
 * A discovered PR with its repository context (used internally by analysis)
 */
export interface DiscoveredPR {
  readonly pr: PullRequest;
  readonly repoOwner: string;
  readonly repoName: string;
}

/**
 * Logger interface for pr-analyzer consumers to implement
 */
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
