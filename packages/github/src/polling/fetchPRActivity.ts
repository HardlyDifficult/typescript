
import type { Octokit } from "@octokit/rest";

import type {
  CheckRun,
  PullRequestComment,
  PullRequestReview,
  WatchThrottle,
} from "../types.js";

import type { PRSnapshot } from "./processSnapshot.js";

export interface PRActivity {
  readonly comments: readonly PullRequestComment[];
  readonly reviews: readonly PullRequestReview[];
  readonly checkRuns: readonly CheckRun[];
}

/** Fetches comments, reviews, and check runs for a pull request in parallel. */
export async function fetchPRActivity(
  octokit: Octokit,
  owner: string,
  name: string,
  number: number,
  headSha: string
): Promise<PRActivity> {
  const [commentsRes, reviewsRes, checksRes] = await Promise.all([
    octokit.issues.listComments({
      owner,
      repo: name,
      issue_number: number,
      per_page: 100,
    }),
    octokit.pulls.listReviews({
      owner,
      repo: name,
      pull_number: number,
      per_page: 100,
    }),
    octokit.checks.listForRef({
      owner,
      repo: name,
      ref: headSha,
      per_page: 100,
    }),
  ]);

  return {
    comments: commentsRes.data as unknown as readonly PullRequestComment[],
    reviews: reviewsRes.data as unknown as readonly PullRequestReview[],
    checkRuns: checksRes.data.check_runs as unknown as readonly CheckRun[],
  };
}

export interface SelectiveResult {
  readonly activity: PRActivity;
  /** Number of API calls made (0 = full cache hit, 1 = check runs only, 3 = full fetch). */
  readonly apiCalls: number;
}

/** Fetches PR activity selectively, reusing cached data when the PR hasn't changed. */
export async function fetchPRActivitySelective(
  octokit: Octokit,
  owner: string,
  name: string,
  number: number,
  headSha: string,
  updatedAt: string,
  previous: PRSnapshot | undefined,
  throttle: WatchThrottle | undefined
): Promise<SelectiveResult> {
  if (previous?.updatedAt !== updatedAt || previous.headSha !== headSha) {
    await throttle?.wait(3);
    const activity = await fetchPRActivity(
      octokit,
      owner,
      name,
      number,
      headSha
    );
    return { activity, apiCalls: 3 };
  }

  if (previous.hasIncompleteChecks) {
    await throttle?.wait(1);
    const checksRes = await octokit.checks.listForRef({
      owner,
      repo: name,
      ref: headSha,
      per_page: 100,
    });
    return {
      activity: {
        comments: previous.cachedActivity.comments,
        reviews: previous.cachedActivity.reviews,
        checkRuns: checksRes.data.check_runs as unknown as readonly CheckRun[],
      },
      apiCalls: 1,
    };
  }

  return { activity: previous.cachedActivity, apiCalls: 0 };
}
