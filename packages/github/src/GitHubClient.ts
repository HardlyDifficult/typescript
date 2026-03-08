import { Octokit } from "@octokit/rest";

import { PRWatcher } from "./PRWatcher.js";
import { RepoClient } from "./RepoClient.js";
import type {
  ContributionRepo,
  GitHubClientConfig,
  PullRequest,
  WatchOptions,
} from "./types.js";

export { PRClient } from "./PRClient.js";
export { RepoClient } from "./RepoClient.js";

/**
 * Create a configured GitHub client instance.
 */
export function github(config: GitHubClientConfig = {}): GitHubClient {
  return new GitHubClient(config);
}

/** Top-level GitHub API client that provides access to repositories, PR watching, and user contribution queries. */
export class GitHubClient {
  private readonly octokit: Octokit;
  private usernamePromise: Promise<string> | undefined;

  constructor(config: GitHubClientConfig = {}) {
    const resolvedToken =
      config.token ?? process.env.GH_PAT ?? process.env.GITHUB_TOKEN;
    if (resolvedToken === undefined || resolvedToken === "") {
      throw new Error(
        "GitHub token is required (pass token or set GH_PAT/GITHUB_TOKEN)"
      );
    }

    this.octokit = new Octokit({ auth: resolvedToken });
  }

  repo(owner: string, repo: string): RepoClient {
    return new RepoClient(this.octokit, owner, repo);
  }

  watch(options: WatchOptions): PRWatcher {
    return new PRWatcher(this.octokit, () => this.getUsername(), options);
  }

  async ownerRepositories(owner: string): Promise<readonly ContributionRepo[]> {
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

  async contributedRepositories(
    days: number
  ): Promise<readonly ContributionRepo[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const username = await this.getUsername();
    const query = `author:${username} created:>=${since.toISOString().split("T")[0]}`;
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

  async myOpenPRs(): Promise<
    readonly {
      readonly pr: PullRequest;
      readonly repo: { readonly owner: string; readonly name: string };
    }[]
  > {
    const username = await this.getUsername();
    const pattern = /repos\/([^/]+)\/([^/]+)$/;

    const response = await this.octokit.search.issuesAndPullRequests({
      q: `is:pr is:open author:${username}`,
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

  private getUsername(): Promise<string> {
    this.usernamePromise ??= this.octokit.users
      .getAuthenticated()
      .then(({ data }) => data.login);
    return this.usernamePromise;
  }
}
