import { type Octokit } from "@octokit/rest";

import { buildTimeline, type TimelineEntry } from "./timeline.js";
import type {
  CheckRun,
  PullRequest,
  PullRequestComment,
  PullRequestCommit,
  PullRequestFile,
  PullRequestReview,
  PullRequestSnapshot,
  Repository,
} from "./types.js";

/** Client for interacting with a specific GitHub pull request (comments, reviews, check runs, merging). */
export class PRClient {
  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;
  private readonly number: number;

  /** @internal */
  constructor(octokit: Octokit, owner: string, repo: string, number: number) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
    this.number = number;
  }

  async details(): Promise<PullRequest> {
    const response = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
    });

    return response.data as unknown as PullRequest;
  }

  async diff(): Promise<string> {
    const response = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      mediaType: {
        format: "diff",
      },
    });

    return response.data as unknown as string;
  }

  async files(): Promise<readonly PullRequestFile[]> {
    const response = await this.octokit.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestFile[];
  }

  async commits(): Promise<readonly PullRequestCommit[]> {
    const response = await this.octokit.pulls.listCommits({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestCommit[];
  }

  async reviews(): Promise<readonly PullRequestReview[]> {
    const response = await this.octokit.pulls.listReviews({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestReview[];
  }

  async comments(): Promise<readonly PullRequestComment[]> {
    const response = await this.octokit.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: this.number,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestComment[];
  }

  async checks(): Promise<readonly CheckRun[]> {
    const { checks } = await this.loadActivity();
    return checks;
  }

  async comment(body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: this.number,
      body,
    });
  }

  /** Fetch comments, reviews, and commits in parallel, then merge into a sorted timeline. */
  async timeline(): Promise<readonly TimelineEntry[]> {
    const { timeline } = await this.loadActivity({ includeTimeline: true });
    return timeline;
  }

  async load(): Promise<PullRequestSnapshot> {
    const { pullRequest, comments, reviews, checks, timeline } =
      await this.loadActivity({ includeTimeline: true });

    return {
      pullRequest,
      repository: pullRequest.base.repo as Repository,
      comments,
      reviews,
      checks,
      timeline,
    };
  }

  async merge(title: string): Promise<void> {
    await this.octokit.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      merge_method: "squash",
      commit_title: title,
    });
  }

  async markReady(): Promise<void> {
    await this.octokit.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      draft: false,
    });
  }

  async enableAutoMerge(
    mergeMethod: "SQUASH" | "MERGE" | "REBASE" = "SQUASH"
  ): Promise<void> {
    // Get PR node ID (needed for GraphQL)
    const { data: pr } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
    });

    // Enable auto-merge via GraphQL
    await this.octokit.graphql(
      `mutation($prId: ID!, $mergeMethod: PullRequestMergeMethod!) {
        enablePullRequestAutoMerge(input: {
          pullRequestId: $prId,
          mergeMethod: $mergeMethod
        }) {
          pullRequest {
            id
          }
        }
      }`,
      {
        prId: pr.node_id,
        mergeMethod,
      }
    );
  }

  private async loadActivity(options: {
    includeTimeline?: boolean;
  } = {}): Promise<{
    pullRequest: PullRequest;
    comments: readonly PullRequestComment[];
    reviews: readonly PullRequestReview[];
    checks: readonly CheckRun[];
    timeline: readonly TimelineEntry[];
  }> {
    const pullRequest = await this.details();
    const [comments, reviews, checks, commits] = await Promise.all([
      this.comments(),
      this.reviews(),
      this.listChecks(pullRequest.head.sha),
      options.includeTimeline ? this.commits() : Promise.resolve([]),
    ]);

    return {
      pullRequest,
      comments,
      reviews,
      checks,
      timeline: buildTimeline(
        comments,
        reviews,
        commits as readonly PullRequestCommit[]
      ),
    };
  }

  private async listChecks(headSha: string): Promise<readonly CheckRun[]> {
    const response = await this.octokit.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: headSha,
      per_page: 100,
    });

    return response.data.check_runs as unknown as readonly CheckRun[];
  }
}
