/**
 * Repository manager for cloning and managing local copies of git repositories.
 * Used by the AI SDK agent to access source code for analysis.
 */

import {
  writeFile as fsWriteFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";

import type { SimpleGitFactory } from "simple-git";

import {
  type CachedRepo,
  cloneRepo,
  errorMessage,
  fetchAndCheckoutExisting,
} from "./gitOperations.js";

/** Configuration for the repository manager */
export interface RepoConfig {
  /** Base directory for cloning repositories */
  readonly baseDir: string;
  /** Maximum number of cached repositories */
  readonly maxCachedRepos: number;
  /** Cache TTL in milliseconds */
  readonly cacheTtlMs: number;
  /** GitHub token for cloning private repos */
  readonly githubToken?: string | undefined;
}

/** Information about a repository to clone/checkout */
export interface RepositoryInfo {
  /** Full clone URL (HTTPS format) */
  cloneUrl: string;

  /** Branch to checkout */
  branch: string;

  /**
   * Base branch to checkout first (when creating a local branch).
   * If set, the repo manager will checkout this branch, then create
   * a local branch with the name specified in `branch`.
   */
  baseBranch?: string;

  /** Specific commit SHA (optional, for precise checkout) */
  commitSha?: string;

  /** Repository owner (e.g., "HardlyDifficult") */
  owner: string;

  /** Repository name (e.g., "garden") */
  name: string;

  /**
   * If true, use the default branch when the specified branch doesn't exist.
   * Useful for closed PRs where the head branch may have been deleted.
   */
  useDefaultBranch?: boolean;
}

/** Maximum file size that can be read (1MB) */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Manages local clones of git repositories for code analysis.
 */
export class RepoManager {
  private readonly config: RepoConfig;
  private readonly cachedRepos = new Map<string, CachedRepo>();
  private readonly pendingEnsureRepos = new Map<string, Promise<string>>();
  private simpleGit: SimpleGitFactory | null = null;

  constructor(config: RepoConfig) {
    this.config = config;
  }

  /** Lazily load simple-git to avoid issues if it's not installed. */
  private async getSimpleGit(): Promise<SimpleGitFactory> {
    if (!this.simpleGit) {
      const { simpleGit } = await import("simple-git");
      this.simpleGit = simpleGit;
    }
    return this.simpleGit;
  }

  private getCacheKey(owner: string, name: string): string {
    return `${owner}/${name}`;
  }

  private getRepoPath(owner: string, name: string): string {
    return path.join(this.config.baseDir, owner, name);
  }

  private updateCache(
    cacheKey: string,
    info: RepositoryInfo,
    repoPath: string,
    actualBranch: string
  ): void {
    this.cachedRepos.set(cacheKey, {
      owner: info.owner,
      name: info.name,
      localPath: repoPath,
      currentBranch: actualBranch,
      currentCommit: info.commitSha,
      lastAccessedAt: new Date(),
    });
  }

  /**
   * Ensure a repository is cloned and checked out to the specified branch.
   * Returns the local path to the repository.
   */
  async ensureRepo(info: RepositoryInfo): Promise<string> {
    const cacheKey = this.getCacheKey(info.owner, info.name);

    // Serialize concurrent repo operations to prevent git index.lock conflicts.
    const existing = this.pendingEnsureRepos.get(cacheKey);
    const next = (existing?.catch(() => undefined) ?? Promise.resolve()).then(
      () => this._ensureRepo(info)
    );

    this.pendingEnsureRepos.set(cacheKey, next);

    return next.finally(() => {
      if (this.pendingEnsureRepos.get(cacheKey) === next) {
        this.pendingEnsureRepos.delete(cacheKey);
      }
    });
  }

  private async _ensureRepo(info: RepositoryInfo): Promise<string> {
    const cacheKey = this.getCacheKey(info.owner, info.name);
    const repoPath = this.getRepoPath(info.owner, info.name);
    const simpleGit = await this.getSimpleGit();

    console.warn(`[RepoManager] Ensuring repo ${cacheKey} at ${repoPath}`);

    try {
      const stats = await stat(repoPath).catch(() => null);
      const repoExists = stats?.isDirectory() === true;

      if (repoExists) {
        console.warn(`[RepoManager] Repo exists, fetching updates...`);

        try {
          const git = simpleGit(repoPath);
          const actualBranch = await fetchAndCheckoutExisting(
            git,
            simpleGit,
            info,
            repoPath,
            cacheKey
          );
          this.updateCache(cacheKey, info, repoPath, actualBranch);
          console.warn(`[RepoManager] Repo updated successfully`);
          return repoPath;
        } catch (fetchError) {
          if (
            fetchError instanceof Error &&
            "reclone" in fetchError &&
            (fetchError as Error & { reclone: boolean }).reclone
          ) {
            await rm(repoPath, { recursive: true, force: true });
          } else {
            throw fetchError;
          }
        }
      }

      // Clone path: repo doesn't exist or was deleted due to unremovable lock file.
      console.warn(`[RepoManager] Cloning repo...`);

      const actualBranch = await cloneRepo(
        simpleGit,
        info,
        repoPath,
        this.config
      );
      this.updateCache(cacheKey, info, repoPath, actualBranch);
      await this.cleanupOldRepos();

      console.warn(`[RepoManager] Repo cloned successfully`);
      return repoPath;
    } catch (error) {
      console.error(`[RepoManager] Failed to ensure repo:`, error);
      throw new Error(
        `Failed to clone/update repository: ${errorMessage(error)}`,
        { cause: error }
      );
    }
  }

  /**
   * Validate a file path to prevent directory traversal attacks.
   * Returns the full resolved path if valid, throws if invalid.
   */
  private validatePath(basePath: string, requestedPath: string): string {
    const resolvedBase = path.resolve(basePath);
    const normalizedRequest = path.normalize(requestedPath);
    const fullPath = path.resolve(basePath, normalizedRequest);

    if (
      !fullPath.startsWith(resolvedBase + path.sep) &&
      fullPath !== resolvedBase
    ) {
      throw new Error(`Path traversal detected: ${requestedPath}`);
    }

    return fullPath;
  }

  /**
   * Read a file from a cloned repository.
   * @param repoPath - The local path to the repository
   * @param filePath - The path to the file relative to the repository root
   */
  async readFile(repoPath: string, filePath: string): Promise<string> {
    const fullPath = this.validatePath(repoPath, filePath);

    const stats = await stat(fullPath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${String(stats.size)} bytes (max: ${String(MAX_FILE_SIZE)} bytes)`
      );
    }

    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }

    return readFile(fullPath, "utf-8");
  }

  /**
   * Write a file in a cloned repository.
   * Creates parent directories if they don't exist.
   * @param repoPath - The local path to the repository
   * @param filePath - The path to the file relative to the repository root
   * @param content - The content to write
   */
  async writeFile(
    repoPath: string,
    filePath: string,
    content: string
  ): Promise<void> {
    const fullPath = this.validatePath(repoPath, filePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await fsWriteFile(fullPath, content, "utf-8");
  }

  /**
   * List the contents of a directory in a cloned repository.
   * @param repoPath - The local path to the repository
   * @param dirPath - The path to the directory relative to the repository root
   */
  async listDirectory(repoPath: string, dirPath: string): Promise<string[]> {
    const fullPath = this.validatePath(repoPath, dirPath);

    const stats = await stat(fullPath);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${dirPath}`);
    }

    const entries = await readdir(fullPath, { withFileTypes: true });

    return entries.map((entry) => {
      const suffix = entry.isDirectory() ? "/" : "";
      return entry.name + suffix;
    });
  }

  /**
   * Search for files matching a glob pattern.
   * @param repoPath - The local path to the repository
   * @param pattern - Glob pattern (e.g., "**\/*.tsx")
   */
  async searchFiles(repoPath: string, pattern: string): Promise<string[]> {
    const { glob } = await import("tinyglobby");

    const matches = await glob([pattern], {
      cwd: repoPath,
      onlyFiles: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
    });

    return matches.slice(0, 100); // Limit results
  }

  /** Clean up old cached repositories to stay under the limit. */
  private async cleanupOldRepos(): Promise<void> {
    if (this.cachedRepos.size <= this.config.maxCachedRepos) {
      return;
    }

    const sorted = [...this.cachedRepos.entries()].sort(
      (a, b) => a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime()
    );

    const toRemove = sorted.slice(
      0,
      sorted.length - this.config.maxCachedRepos
    );

    for (const [key, repo] of toRemove) {
      console.warn(`[RepoManager] Removing old cached repo: ${key}`);
      try {
        await rm(repo.localPath, { recursive: true, force: true });
        this.cachedRepos.delete(key);
      } catch (error) {
        console.error(`[RepoManager] Failed to remove repo ${key}:`, error);
      }
    }
  }

  /** Clean up all cached repositories. */
  async cleanup(): Promise<void> {
    console.warn(`[RepoManager] Cleaning up all cached repos...`);

    for (const [key, repo] of this.cachedRepos) {
      try {
        await rm(repo.localPath, { recursive: true, force: true });
      } catch (error) {
        console.error(`[RepoManager] Failed to remove repo ${key}:`, error);
      }
    }

    this.cachedRepos.clear();
    console.warn(`[RepoManager] Cleanup complete`);
  }
}
