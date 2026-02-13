import type { Octokit } from "@octokit/rest";

import type {
  CheckRun,
  PullRequestComment,
  PullRequestReview,
} from "../types.js";

export interface PRActivity {
  readonly comments: readonly PullRequestComment[];
  readonly reviews: readonly PullRequestReview[];
  readonly checkRuns: readonly CheckRun[];
}

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
