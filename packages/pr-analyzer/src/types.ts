/**
 * PR Analysis Types
 */

import type {
  CheckRun,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
  Repository,
} from "@hardlydifficult/github";

/**
 * Core PR statuses derived purely from GitHub data.
 * Consumers can extend with custom statuses via AnalyzerHooks.
 */
export type CorePRStatus =
  | "draft"
  | "ci_running"
  | "ci_failed"
  | "needs_review"
  | "changes_requested"
  | "approved"
  | "has_conflicts"
  | "ready_to_merge"
  | "waiting_on_bot";

/**
 * A PR that has been scanned and analyzed.
 * Status is `string` to allow custom statuses from hooks.
 */
export interface ScannedPR {
  readonly pr: PullRequest;
  readonly repo: Repository;
  readonly status: string;
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

/**
 * Raw analysis data passed to hooks for custom status resolution.
 */
export interface AnalysisDetails {
  readonly comments: readonly PullRequestComment[];
  readonly checks: readonly CheckRun[];
  readonly reviews: readonly PullRequestReview[];
  readonly ciStatus: CIStatus;
  readonly hasConflicts: boolean;
  readonly waitingOnBot: boolean;
}

/**
 * Hooks for customizing analysis behavior.
 * Consumers can override status determination with custom logic.
 */
export interface AnalyzerHooks {
  /**
   * Called after the core status is determined.
   * Return a custom status string to override, or undefined to keep the core status.
   */
  readonly resolveStatus?: (
    coreStatus: CorePRStatus,
    details: AnalysisDetails
  ) => string | undefined;
}

/**
 * Configuration for extending classification buckets with custom statuses.
 */
export interface ClassificationConfig {
  readonly readyForHuman?: readonly string[];
  readonly inProgress?: readonly string[];
  readonly blocked?: readonly string[];
  readonly needsBotBump?: readonly string[];
}

/**
 * Definition for a custom action provided by consumers.
 */
export interface ActionDefinition {
  readonly type: string;
  readonly label: string;
  readonly description: string;
  readonly when: (pr: ScannedPR, context: Record<string, boolean>) => boolean;
}
