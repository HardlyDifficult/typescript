import { Octokit } from "@octokit/rest";

import { PRWatcher } from "./PRWatcher.js";
import { buildTimeline, type TimelineEntry } from "./timeline.js";
import type {
  CheckRun,
  ContributionRepo,
  KeyFile,
  PullRequest,
  PullRequestComment,
  PullRequestCommit,
  PullRequestFile,
  PullRequestReview,
  RepoContext,
  Repository,
  TreeEntry,
  WatchOptions,
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
}

/** Client for interacting with a specific GitHub repository (PRs, file tree, file content). */
export class RepoClient {
  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly name: string;

  /** @internal */
  constructor(octokit: Octokit, owner: string, name: string) {
    this.octokit = octokit;
    this.owner = owner;
    this.name = name;
  }

  pr(number: number): PRClient {
    return new PRClient(this.octokit, this.owner, this.name, number);
  }

  async getOpenPRs(): Promise<readonly PullRequest[]> {
    const response = await this.octokit.pulls.list({
      owner: this.owner,
      repo: this.name,
      state: "open",
      per_page: 100,
    });

    return response.data as unknown as readonly PullRequest[];
  }

  async get(): Promise<Repository> {
    const response = await this.octokit.repos.get({
      owner: this.owner,
      repo: this.name,
    });

    return response.data as unknown as Repository;
  }

  async getFileTree(sha = "HEAD"): Promise<readonly TreeEntry[]> {
    const response = await this.octokit.git.getTree({
      owner: this.owner,
      repo: this.name,
      tree_sha: sha,
      recursive: "1",
    });

    return response.data.tree as unknown as readonly TreeEntry[];
  }

  async getFileContent(filePath: string, ref?: string): Promise<string> {
    const response = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.name,
      path: filePath,
      ...(ref !== undefined ? { ref } : {}),
    });

    const data = response.data as { content?: string; encoding?: string };
    return Buffer.from(data.content ?? "", "base64").toString("utf-8");
  }

  /** Fetch the file tree and a set of key files for AI context gathering. */
  async gatherContext(
    filesToFetch: readonly string[],
    maxFileChars: number
  ): Promise<RepoContext> {
    const tree = await this.getFileTree();
    const filePaths = tree.filter((e) => e.type === "blob").map((e) => e.path);
    const treePathSet = new Set(filePaths);
    const keyFiles: KeyFile[] = [];

    for (const path of filesToFetch) {
      if (!treePathSet.has(path)) {
        continue;
      }
      try {
        const content = await this.getFileContent(path);
        keyFiles.push({ path, content: content.slice(0, maxFileChars) });
      } catch {
        // File not accessible — skip
      }
    }

    return { filePaths, keyFiles };
  }
}

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
