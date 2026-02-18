import { type Octokit } from "@octokit/rest";

import { buildTimeline, type TimelineEntry } from "./timeline.js";
import type {
  CheckRun,
  PullRequest,
  PullRequestComment,
  PullRequestCommit,
  PullRequestFile,
  PullRequestReview,
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

  async get(): Promise<PullRequest> {
    const response = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
    });

    return response.data as unknown as PullRequest;
  }

  async getDiff(): Promise<string> {
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

  async getFiles(): Promise<readonly PullRequestFile[]> {
    const response = await this.octokit.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestFile[];
  }

  async getCommits(): Promise<readonly PullRequestCommit[]> {
    const response = await this.octokit.pulls.listCommits({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestCommit[];
  }

  async getReviews(): Promise<readonly PullRequestReview[]> {
    const response = await this.octokit.pulls.listReviews({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestReview[];
  }

  async getComments(): Promise<readonly PullRequestComment[]> {
    const response = await this.octokit.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: this.number,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestComment[];
  }

  async getCheckRuns(): Promise<readonly CheckRun[]> {
    const pr = await this.get();
    const response = await this.octokit.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: pr.head.sha,
      per_page: 100,
    });

    return response.data.check_runs as unknown as readonly CheckRun[];
  }

  async postComment(body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: this.number,
      body,
    });
  }

  /** Fetch comments, reviews, and commits in parallel, then merge into a sorted timeline. */
  async getTimeline(): Promise<readonly TimelineEntry[]> {
    const [comments, reviews, commits] = await Promise.all([
      this.getComments(),
      this.getReviews(),
      this.getCommits(),
    ]);
    return buildTimeline(comments, reviews, commits);
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
}
