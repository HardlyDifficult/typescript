import { Octokit } from "@octokit/rest";

import type {
  CheckRun,
  ContributionRepo,
  PullRequest,
  PullRequestComment,
  PullRequestCommit,
  PullRequestFile,
  PullRequestReview,
  Repository,
} from "./types.js";

export class GitHubClient {
  private readonly octokit: Octokit;
  private readonly username: string;

  constructor(token: string, username: string) {
    this.octokit = new Octokit({ auth: token });
    this.username = username;
  }

  async getContributedRepos(
    days: number
  ): Promise<readonly ContributionRepo[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const query = `author:${this.username} created:>=${since.toISOString().split("T")[0]}`;
    const repos = new Map<string, ContributionRepo>();

    const pattern = /repos\/([^/]+)\/([^/]+)$/;

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const prResults = await this.octokit.search.issuesAndPullRequests({
      q: `${query} is:pr`,
      per_page: 100,
      sort: "updated",
    });

    for (const item of prResults.data.items) {
      const repoUrl = item.repository_url;
      const match = pattern.exec(repoUrl);
      if (match !== null) {
        const [, owner, name] = match;
        const fullName = `${owner}/${name}`;
        if (!repos.has(fullName)) {
          repos.set(fullName, { owner, name, fullName });
        }
      }
    }

    return Array.from(repos.values());
  }

  async getOpenPRs(
    owner: string,
    repo: string
  ): Promise<readonly PullRequest[]> {
    const response = await this.octokit.pulls.list({
      owner,
      repo,
      state: "open",
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequest[];
  }

  async getPR(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PullRequest> {
    const response = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return response.data as unknown as PullRequest;
  }

  async getPRDiff(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<string> {
    const response = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: {
        format: "diff",
      },
    });

    return response.data as unknown as string;
  }

  async getPRFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<readonly PullRequestFile[]> {
    const response = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestFile[];
  }

  async getPRCommits(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<readonly PullRequestCommit[]> {
    const response = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestCommit[];
  }

  async getCheckRuns(
    owner: string,
    repo: string,
    ref: string
  ): Promise<readonly CheckRun[]> {
    const response = await this.octokit.checks.listForRef({
      owner,
      repo,
      ref,
      per_page: 100,
    });

    return response.data.check_runs as unknown as readonly CheckRun[];
  }

  async getPRComments(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<readonly PullRequestComment[]> {
    const response = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestComment[];
  }

  async getPRReviews(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<readonly PullRequestReview[]> {
    const response = await this.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequestReview[];
  }

  async postComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<void> {
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    const response = await this.octokit.repos.get({
      owner,
      repo,
    });

    return response.data as unknown as Repository;
  }

  async mergePR(
    owner: string,
    repo: string,
    prNumber: number,
    title: string
  ): Promise<void> {
    await this.octokit.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: "squash",
      commit_title: title,
    });
  }

  async getOwnerRepos(owner: string): Promise<readonly ContributionRepo[]> {
    const repos: ContributionRepo[] = [];

    try {
      const orgResponse = await this.octokit.repos.listForOrg({
        org: owner,
        type: "public",
        per_page: 100,
      });

      for (const repo of orgResponse.data) {
        repos.push({
          owner,
          name: repo.name,
          fullName: repo.full_name,
        });
      }
    } catch {
      const userResponse = await this.octokit.repos.listForUser({
        username: owner,
        type: "owner",
        per_page: 100,
      });

      for (const repo of userResponse.data) {
        repos.push({
          owner,
          name: repo.name,
          fullName: repo.full_name,
        });
      }
    }

    return repos;
  }

  async getMyOpenPRs(): Promise<
    readonly {
      readonly pr: PullRequest;
      readonly repo: { readonly owner: string; readonly name: string };
    }[]
  > {
    const pattern = /repos\/([^/]+)\/([^/]+)$/;

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const response = await this.octokit.search.issuesAndPullRequests({
      q: `is:pr is:open author:${this.username}`,
      per_page: 100,
      sort: "updated",
    });

    const results: {
      pr: PullRequest;
      repo: { owner: string; name: string };
    }[] = [];

    for (const item of response.data.items) {
      const repoUrl = item.repository_url;
      const match = pattern.exec(repoUrl);
      if (match !== null) {
        const [, owner, name] = match;
        const pr = await this.getPR(owner, name, item.number);
        results.push({ pr, repo: { owner, name } });
      }
    }

    return results;
  }
}
