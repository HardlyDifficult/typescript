/**
 * PR Analysis
 *
 * Analyzes a single PR to determine its status:
 *   1. Fetch CI checks, comments, reviews, and repo info
 *   2. Analyze CI status (running, failed, passed)
 *   3. Check if waiting on a bot response
 *   4. Determine overall PR status based on all factors
 *
 * Custom status logic can be injected via AnalyzerHooks.resolveStatus.
 */

import type {
  CheckRun,
  GitHubClient,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
} from "@hardlydifficult/github";

import type {
  AnalyzerHooks,
  CIStatus,
  CorePRStatus,
  DiscoveredPR,
  Logger,
  ScannedPR,
} from "./types.js";

// Bot usernames to detect when waiting for bot response
const BOT_USERNAMES = new Set([
  "cursor",
  "cursor-bot",
  "github-actions",
  "github-actions[bot]",
  "dependabot",
  "dependabot[bot]",
  "renovate",
  "renovate[bot]",
  "codecov",
  "codecov[bot]",
  "vercel",
  "vercel[bot]",
  "claude",
]);

/**
 * Analyze a PR and determine its status
 */
export async function analyzePR(
  client: GitHubClient,
  owner: string,
  repo: string,
  pr: PullRequest,
  botMention: string,
  hooks?: AnalyzerHooks,
): Promise<ScannedPR> {
  // Fetch all required data in parallel
  const repoClient = client.repo(owner, repo);
  const prClient = repoClient.pr(pr.number);
  const [checks, comments, reviews, repoInfo] = await Promise.all([
    prClient.getCheckRuns(),
    prClient.getComments(),
    prClient.getReviews(),
    repoClient.get(),
  ]);

  // Analyze the fetched data
  const ciStatus = analyzeCIStatus(checks);
  const waitingOnBot = isWaitingOnBot(comments, botMention);
  const conflicting = hasConflicts(pr);
  const coreStatus = determineStatus(pr, ciStatus, reviews, waitingOnBot);

  // Allow hook to override status
  const status =
    hooks?.resolveStatus?.(coreStatus, {
      comments,
      checks,
      reviews,
      ciStatus,
      hasConflicts: conflicting,
      waitingOnBot,
    }) ?? coreStatus;

  const daysSinceUpdate = calculateDaysSinceUpdate(pr.updated_at);

  return {
    pr,
    repo: repoInfo,
    status,
    ciStatus,
    ciSummary: ciStatus.summary,
    hasConflicts: conflicting,
    waitingOnBot,
    daysSinceUpdate,
  };
}

/**
 * Analyze all discovered PRs, logging any failures
 */
export async function analyzeAll(
  prs: readonly DiscoveredPR[],
  client: GitHubClient,
  botMention: string,
  logger?: Logger,
  hooks?: AnalyzerHooks,
): Promise<ScannedPR[]> {
  const results: ScannedPR[] = [];

  for (const { pr, repoOwner, repoName } of prs) {
    try {
      results.push(
        await analyzePR(client, repoOwner, repoName, pr, botMention, hooks),
      );
    } catch (err) {
      logger?.error("Failed to analyze PR", {
        repo: `${repoOwner}/${repoName}`,
        pr: pr.number,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

// --- Status Determination ---

/**
 * Determine the core status of a PR based on GitHub data.
 *
 * Priority order:
 *   1. Draft → draft
 *   2. CI running → ci_running
 *   3. CI failed → ci_failed
 *   4. Has conflicts → has_conflicts
 *   5. Waiting on bot → waiting_on_bot
 *   6. Changes requested → changes_requested
 *   7. CI passed → ready_to_merge
 *   8. Approved → approved
 *   9. Default → needs_review
 */
function determineStatus(
  pr: PullRequest,
  ci: CIStatus,
  reviews: readonly PullRequestReview[],
  waitingOnBot: boolean,
): CorePRStatus {
  if (pr.draft) {
    return "draft";
  }
  if (ci.isRunning) {
    return "ci_running";
  }
  if (ci.hasFailed) {
    return "ci_failed";
  }
  if (hasConflicts(pr)) {
    return "has_conflicts";
  }
  if (waitingOnBot) {
    return "waiting_on_bot";
  }

  const reviewStatus = analyzeReviews(reviews);
  if (reviewStatus.hasChangesRequested) {
    return "changes_requested";
  }
  if (ci.allPassed) {
    return "ready_to_merge";
  }
  if (reviewStatus.hasApproval) {
    return "approved";
  }

  return "needs_review";
}

// --- CI Analysis ---

function analyzeCIStatus(checks: readonly CheckRun[]): CIStatus {
  if (checks.length === 0) {
    return {
      isRunning: false,
      hasFailed: false,
      allPassed: true,
      summary: "No CI checks",
    };
  }

  const running = checks.filter(isCheckRunning);
  const failed = checks.filter(isCheckFailed);
  const passed = checks.filter(isCheckPassed);

  // Validate that all checks are categorized
  const categorized = running.length + failed.length + passed.length;
  if (categorized !== checks.length) {
    const uncategorized = checks.filter(
      (c) => !isCheckRunning(c) && !isCheckFailed(c) && !isCheckPassed(c),
    );
    running.push(...uncategorized);
  }

  const isRunning = running.length > 0;
  const hasFailed = failed.length > 0;
  const allPassed = !isRunning && !hasFailed && passed.length === checks.length;

  return {
    isRunning,
    hasFailed,
    allPassed,
    summary: formatCISummary(running, failed, passed, checks.length),
  };
}

function isCheckRunning(check: CheckRun): boolean {
  if (check.status === "in_progress" || check.status === "queued") {
    return true;
  }
  return check.conclusion === null;
}

function isCheckFailed(check: CheckRun): boolean {
  return (
    check.status === "completed" &&
    (check.conclusion === "failure" ||
      check.conclusion === "timed_out" ||
      check.conclusion === "cancelled" ||
      check.conclusion === "action_required")
  );
}

function isCheckPassed(check: CheckRun): boolean {
  return (
    check.status === "completed" &&
    (check.conclusion === "success" ||
      check.conclusion === "skipped" ||
      check.conclusion === "neutral")
  );
}

function formatCISummary(
  running: CheckRun[],
  failed: CheckRun[],
  passed: CheckRun[],
  total: number,
): string {
  if (running.length > 0 && passed.length > 0) {
    return `CI running: ${String(running.length)} in progress, ${String(passed.length)} passed`;
  }
  if (running.length > 0) {
    return `CI running: ${String(running.length)} in progress`;
  }
  if (failed.length > 0 && passed.length > 0) {
    return `CI failed: ${String(failed.length)} failed, ${String(passed.length)} passed`;
  }
  if (failed.length > 0) {
    return `CI failed: ${failed.map((c) => c.name).join(", ")}`;
  }
  if (passed.length === total) {
    return `CI passed: ${String(passed.length)} checks`;
  }
  return `CI: ${String(total)} checks`;
}

// --- Review Analysis ---

function analyzeReviews(reviews: readonly PullRequestReview[]): {
  hasChangesRequested: boolean;
  hasApproval: boolean;
} {
  const latestByUser = new Map<string, PullRequestReview>();
  for (const review of reviews) {
    const existing = latestByUser.get(review.user.login);
    if (
      existing === undefined ||
      new Date(review.submitted_at) > new Date(existing.submitted_at)
    ) {
      latestByUser.set(review.user.login, review);
    }
  }

  const latestReviews = Array.from(latestByUser.values());
  return {
    hasChangesRequested: latestReviews.some(
      (r) => r.state === "CHANGES_REQUESTED",
    ),
    hasApproval: latestReviews.some((r) => r.state === "APPROVED"),
  };
}

// --- Bot Detection ---

function isWaitingOnBot(
  comments: readonly PullRequestComment[],
  botMention: string,
): boolean {
  if (comments.length === 0) {
    return false;
  }

  const botMentionLower = botMention.toLowerCase();
  const mentionComments = comments.filter((c) =>
    c.body.toLowerCase().includes(botMentionLower),
  );
  if (mentionComments.length === 0) {
    return false;
  }

  const lastMention = mentionComments[mentionComments.length - 1];

  const botComments = comments.filter((c) => isBot(c.user.login));
  if (botComments.length === 0) {
    return true;
  }
  const lastBotComment = botComments[botComments.length - 1];
  return new Date(lastBotComment.created_at) < new Date(lastMention.created_at);
}

function isBot(username: string): boolean {
  const lower = username.toLowerCase();
  return (
    BOT_USERNAMES.has(lower) || lower.endsWith("[bot]") || lower.includes("bot")
  );
}

// --- Utility ---

function hasConflicts(pr: PullRequest): boolean {
  return pr.mergeable === false || pr.mergeable_state === "conflicting";
}

function calculateDaysSinceUpdate(updatedAt: string): number {
  return Math.floor(
    (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
}
