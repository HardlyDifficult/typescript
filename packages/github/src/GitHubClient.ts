import { Octokit } from "@octokit/rest";

import { PRWatcher } from "./PRWatcher.js";
import { RepoClient } from "./RepoClient.js";
import type { ContributionRepo, PullRequest, WatchOptions } from "./types.js";

export { PRClient } from "./PRClient.js";
export { RepoClient } from "./RepoClient.js";

/** Top-level GitHub API client that provides access to repositories, PR watching, and user contribution queries. */
export class GitHubClient {
  private readonly octokit: Octokit;
  private readonly username: string;

  private constructor(octokit: Octokit, username: string) {
    this.octokit = octokit;
    this.username = username;
  }

  static async create(token?: string): Promise<GitHubClient> {
    const resolvedToken = token ?? process.env.GH_PAT;
    if (resolvedToken === undefined || resolvedToken === "") {
      throw new Error("GitHub token is required (pass token or set GH_PAT)");
    }

    const octokit = new Octokit({ auth: resolvedToken });
    const { data } = await octokit.users.getAuthenticated();

    return new GitHubClient(octokit, data.login);
  }

  repo(owner: string, name: string): RepoClient {
    return new RepoClient(this.octokit, owner, name);
  }

  watch(options: WatchOptions): PRWatcher {
    return new PRWatcher(this.octokit, this.username, options);
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

  async getContributedRepos(
    days: number
  ): Promise<readonly ContributionRepo[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const query = `author:${this.username} created:>=${since.toISOString().split("T")[0]}`;
    const repos = new Map<string, ContributionRepo>();

    const pattern = /repos\/([^/]+)\/([^/]+)$/;

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

  async getMyOpenPRs(): Promise<
    readonly {
      readonly pr: PullRequest;
      readonly repo: { readonly owner: string; readonly name: string };
    }[]
  > {
    const pattern = /repos\/([^/]+)\/([^/]+)$/;

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
        const pr = await this.repo(owner, name).pr(item.number).get();
        results.push({ pr, repo: { owner, name } });
      }
    }

    return results;
  }
}
