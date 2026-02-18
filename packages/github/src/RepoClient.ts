import { type Octokit } from "@octokit/rest";

import { PRClient } from "./PRClient.js";
import type {
  CommitFilesOptions,
  CommitResult,
  CreatedPR,
  CreatePROptions,
  FileTreeResult,
  KeyFile,
  PullRequest,
  RepoContext,
  Repository,
  TreeEntry,
} from "./types.js";

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: number }).status === 404
  );
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

  async getFileTree(sha = "HEAD"): Promise<FileTreeResult> {
    const response = await this.octokit.git.getTree({
      owner: this.owner,
      repo: this.name,
      tree_sha: sha,
      recursive: "1",
    });

    return {
      entries: response.data.tree as unknown as readonly TreeEntry[],
      rootSha: response.data.sha,
    };
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
    const { entries: tree } = await this.getFileTree();
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

  /** Fetch the HEAD commit SHA of the repository's default branch. */
  async getDefaultBranchHeadSha(): Promise<string> {
    const repo = await this.get();
    const { data: ref } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.name,
      ref: `heads/${repo.default_branch}`,
    });
    return ref.object.sha;
  }

  /** Get the SHA of a branch ref. Returns null if the branch does not exist. */
  async getBranchSha(branch: string): Promise<string | null> {
    try {
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.name,
        ref: `heads/${branch}`,
      });
      return ref.object.sha;
    } catch (err) {
      if (isNotFoundError(err)) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Merge a head branch into a base branch.
   * Returns the merge commit SHA on success (201), or null when already up-to-date (204).
   */
  async mergeBranch(base: string, head: string): Promise<string | null> {
    const response = await this.octokit.repos.merge({
      owner: this.owner,
      repo: this.name,
      base,
      head,
      commit_message: `Merge ${head} into ${base}`,
    });
    if ((response.status as number) === 204) {
      return null;
    }
    return (response.data as unknown as { sha: string }).sha;
  }

  /** Create a new branch ref pointing to sha. */
  async createBranch(branch: string, sha: string): Promise<void> {
    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.name,
      ref: `refs/heads/${branch}`,
      sha,
    });
  }

  /** Update an existing branch ref to point to a new SHA. */
  async updateBranch(branch: string, sha: string): Promise<void> {
    await this.octokit.git.updateRef({
      owner: this.owner,
      repo: this.name,
      ref: `heads/${branch}`,
      sha,
    });
  }

  /** Create a pull request. Throws on failure. */
  async createPR(options: CreatePROptions): Promise<CreatedPR> {
    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.name,
      head: options.head,
      base: options.base,
      title: options.title,
      body: options.body,
    });
    return { number: data.number, url: data.html_url };
  }

  /**
   * Create blobs, build a tree, commit, then create or update the branch ref.
   * Uses getBranchSha to decide between createBranch and updateBranch.
   */
  async commitFiles(options: CommitFilesOptions): Promise<CommitResult> {
    // 1. Create blobs for each file
    const blobEntries: { path: string; sha: string }[] = [];
    for (const file of options.files) {
      const { data: blob } = await this.octokit.git.createBlob({
        owner: this.owner,
        repo: this.name,
        content: file.content,
        encoding: "utf-8",
      });
      blobEntries.push({ path: file.path, sha: blob.sha });
    }

    // 2. Get the parent commit's tree SHA
    const { data: parentCommit } = await this.octokit.git.getCommit({
      owner: this.owner,
      repo: this.name,
      commit_sha: options.parentSha,
    });
    const baseTreeSha = parentCommit.tree.sha;

    // 3. Create tree
    const { data: tree } = await this.octokit.git.createTree({
      owner: this.owner,
      repo: this.name,
      base_tree: baseTreeSha,
      tree: blobEntries.map((e) => ({
        path: e.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: e.sha,
      })),
    });

    // 4. Create commit
    const { data: commit } = await this.octokit.git.createCommit({
      owner: this.owner,
      repo: this.name,
      message: options.message,
      tree: tree.sha,
      parents: [options.parentSha],
      ...(options.author !== undefined
        ? { author: { name: options.author.name, email: options.author.email } }
        : {}),
    });

    // 5. Create or update branch ref
    const existingSha = await this.getBranchSha(options.branch);
    if (existingSha === null) {
      await this.createBranch(options.branch, commit.sha);
      return { commitSha: commit.sha, branchCreated: true };
    }

    await this.updateBranch(options.branch, commit.sha);
    return { commitSha: commit.sha, branchCreated: false };
  }
}
