/**
 * Git operations for cloning, fetching, and checking out repositories.
 * Extracted from RepoManager to keep file sizes manageable.
 */

import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { retry } from "@hardlydifficult/throttle";
import type { SimpleGit, SimpleGitFactory } from "simple-git";

import type { RepoConfig, RepositoryInfo } from "./manager.js";

/** Information about a cached repository */
export interface CachedRepo {
  owner: string;
  name: string;
  localPath: string;
  currentBranch: string;
  currentCommit: string | undefined;
  lastAccessedAt: Date;
}

/** Detect transient network errors that are safe to retry. */
function isTransientNetworkError(error: unknown): boolean {
  const lower = errorMessage(error).toLowerCase();
  return (
    lower.includes("recv failure") ||
    lower.includes("connection was reset") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("unable to access") ||
    lower.includes("could not resolve host") ||
    lower.includes("tls connection was non-properly terminated") ||
    lower.includes("the remote end hung up unexpectedly")
  );
}

/** Extract a human-readable message from an unknown error value. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isLocalChangesError(error: unknown): boolean {
  const msg = errorMessage(error);
  return msg.includes("local changes") && msg.includes("would be overwritten");
}

function isBranchNotFoundError(error: unknown): boolean {
  const msg = errorMessage(error);
  return (
    (msg.includes("Remote branch") && msg.includes("not found")) ||
    msg.includes("did not match any") ||
    (msg.includes("pathspec") && msg.includes("did not match")) ||
    msg.includes("unknown revision or path not in the working tree")
  );
}

function isReferenceNotATreeError(error: unknown): boolean {
  return errorMessage(error).includes("reference is not a tree");
}

/** Retry a git network operation with exponential backoff for transient errors. */
export async function retryNetworkOp<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  return retry(fn, {
    attempts: 3,
    backoff: { initialDelayMs: 2000, maxDelayMs: 15000 },
    when: (error) => isTransientNetworkError(error),
    onRetry: (error, info) => {
      console.warn(
        `[RepoManager] ${label} failed (attempt ${String(info.attempt)}/3), retrying in ${String(info.delayMs)}ms: ${error.message}`
      );
    },
  });
}

/** Get the default branch name from a repository. */
async function getDefaultBranch(git: SimpleGit): Promise<string> {
  try {
    // Try to get the default branch from remote HEAD
    const remotes = await git.remote(["show", "origin"]);
    const match = remotes?.match(/HEAD branch: (\S+)/);
    if (match?.[1] !== undefined && match[1] !== "") {
      return match[1];
    }
  } catch {
    // Ignore errors, fall through to defaults
  }

  // Try common default branch names
  const branches = await git.branch(["-r"]);
  if (branches.all.includes("origin/main")) {
    return "main";
  }
  if (branches.all.includes("origin/master")) {
    return "master";
  }

  // Return 'main' as final fallback
  return "main";
}

/** Checkout a specific commit SHA, with retry logic for unreachable commits. */
async function checkoutCommitSha(
  git: SimpleGit,
  commitSha: string,
  useDefaultBranch: boolean
): Promise<void> {
  try {
    await git.checkout(commitSha);
  } catch (commitError) {
    if (isReferenceNotATreeError(commitError)) {
      console.warn(
        `[RepoManager] Commit '${commitSha}' not reachable locally, attempting targeted fetch...`
      );
      try {
        await git.fetch(["origin", commitSha]);
        await git.checkout(commitSha);
      } catch (retryError) {
        if (!useDefaultBranch) {
          throw retryError;
        }
        console.warn(
          `[RepoManager] Commit '${commitSha}' not found after targeted fetch, continuing on branch`
        );
      }
    } else if (!useDefaultBranch) {
      throw commitError;
    } else {
      console.warn(
        `[RepoManager] Commit '${commitSha}' not found, continuing on branch`
      );
    }
  }
}

/** Save local changes to a stash branch and push to origin, then reset working tree. */
async function saveLocalChangesToStashBranch(
  git: SimpleGit,
  cacheKey: string
): Promise<void> {
  const id = Math.random().toString(36).slice(2, 10);
  const stashBranch = `stash/${id}`;

  // Remember current branch so we can return to it
  const status = await git.status();
  const originalBranch = status.current ?? "main";

  console.warn(
    `[RepoManager] Saving local changes for ${cacheKey} to branch ${stashBranch}`
  );

  // Create the stash branch from current HEAD
  await git.checkoutLocalBranch(stashBranch);

  // Stage everything and commit
  await git.add("-A");
  // Configure git author identity for commits
  await git.addConfig("user.email", "HardlyDifficult@users.noreply.github.com");
  await git.addConfig("user.name", "HardlyDifficult");
  await git.commit(`[auto-stash] Local changes saved from ${originalBranch}`);

  // Push the stash branch to origin
  try {
    await git.push("origin", stashBranch);
    console.warn(`[RepoManager] Pushed stash branch ${stashBranch} to origin`);
  } catch (pushError) {
    console.warn(
      `[RepoManager] Failed to push stash branch (changes saved locally only):`,
      pushError
    );
  }

  // Return to the original branch and hard-reset to origin
  await git.checkout(originalBranch);
  try {
    await git.reset(["--hard", `origin/${originalBranch}`]);
  } catch {
    // If origin/<branch> doesn't exist yet, just reset to HEAD
    await git.reset(["--hard", "HEAD"]);
  }
}

/** Fetch and checkout an existing repo. Returns the actual branch checked out. */
export async function fetchAndCheckoutExisting(
  git: SimpleGit,
  simpleGit: SimpleGitFactory,
  info: RepositoryInfo,
  repoPath: string,
  cacheKey: string
): Promise<string> {
  // Remove any stale index.lock left by a previously crashed git process.
  const lockFile = path.join(repoPath, ".git", "index.lock");
  try {
    await rm(lockFile);
    console.warn(`[RepoManager] Removed stale index.lock for ${cacheKey}`);
  } catch (lockError) {
    if ((lockError as NodeJS.ErrnoException).code !== "ENOENT") {
      // Lock file exists but can't be removed — signal re-clone needed
      console.warn(
        `[RepoManager] Cannot remove index.lock for ${cacheKey}, will re-clone: ${errorMessage(lockError)}`
      );
      throw Object.assign(new Error("NEEDS_RECLONE"), { reclone: true });
    }
    // code === 'ENOENT': file didn't exist — normal, nothing to do.
  }

  // Fetch latest (retry on transient network errors)
  await retryNetworkOp(() => git.fetch("origin"), "fetch");

  let actualBranch = info.branch;

  // If baseBranch is specified, checkout it first, then create local branch
  if (info.baseBranch !== undefined && info.baseBranch !== "") {
    console.warn(
      `[RepoManager] Creating local branch '${info.branch}' from '${info.baseBranch}'`
    );

    // Checkout the base branch (the one that exists remotely)
    try {
      await git.checkout(info.baseBranch);
      await git.reset(["--hard", `origin/${info.baseBranch}`]);
    } catch (checkoutError) {
      if (isLocalChangesError(checkoutError)) {
        await saveLocalChangesToStashBranch(git, cacheKey);
        await git.checkout(info.baseBranch);
        await git.reset(["--hard", `origin/${info.baseBranch}`]);
      } else {
        throw checkoutError;
      }
    }

    // Create the local retest branch from current HEAD
    await git.checkoutLocalBranch(info.branch);
    actualBranch = info.branch;
  } else {
    // Try to checkout the specified branch (retry once after saving local changes)
    let retried = false;
    const checkoutAndPull = async (): Promise<void> => {
      try {
        await git.checkout(info.branch);
        await git.reset(["--hard", `origin/${info.branch}`]);
      } catch (checkoutError) {
        // If local changes would be overwritten, save them and retry once
        if (!retried && isLocalChangesError(checkoutError)) {
          retried = true;
          await saveLocalChangesToStashBranch(git, cacheKey);
          return checkoutAndPull();
        }
        // If branch not found and useDefaultBranch is set, fall back to default
        if (
          info.useDefaultBranch === true &&
          isBranchNotFoundError(checkoutError)
        ) {
          console.warn(
            `[RepoManager] Branch '${info.branch}' not found, falling back to default branch`
          );
          actualBranch = await getDefaultBranch(git);
          console.warn(`[RepoManager] Using default branch: ${actualBranch}`);
          try {
            await git.checkout(actualBranch);
            await git.reset(["--hard", `origin/${actualBranch}`]);
          } catch (fallbackError) {
            if (!retried && isLocalChangesError(fallbackError)) {
              retried = true;
              await saveLocalChangesToStashBranch(git, cacheKey);
              await git.checkout(actualBranch);
              await git.reset(["--hard", `origin/${actualBranch}`]);
            } else {
              throw fallbackError;
            }
          }
        } else {
          throw checkoutError;
        }
      }
    };
    await checkoutAndPull();
  }

  if (info.commitSha !== undefined && info.commitSha !== "") {
    await checkoutCommitSha(
      git,
      info.commitSha,
      info.useDefaultBranch === true
    );
  }

  await git.raw(["clean", "-fd"]);
  return actualBranch;
}

/** Clone a repository from scratch. Returns the actual branch checked out. */
export async function cloneRepo(
  simpleGit: SimpleGitFactory,
  info: RepositoryInfo,
  repoPath: string,
  config: RepoConfig
): Promise<string> {
  // Ensure parent directory exists
  await mkdir(path.dirname(repoPath), { recursive: true });

  // Build clone URL with auth token if available
  let { cloneUrl } = info;
  if (
    config.githubToken !== undefined &&
    config.githubToken !== "" &&
    cloneUrl.startsWith("https://github.com/")
  ) {
    cloneUrl = cloneUrl.replace(
      "https://github.com/",
      `https://${config.githubToken}@github.com/`
    );
  }

  // Clone the repository
  const git = simpleGit();
  let actualBranch = info.branch;

  // If baseBranch is specified, clone it first, then create local branch
  if (info.baseBranch !== undefined && info.baseBranch !== "") {
    const { baseBranch } = info;
    console.warn(
      `[RepoManager] Cloning base branch '${baseBranch}' for local branch creation`
    );
    await retryNetworkOp(
      () => git.clone(cloneUrl, repoPath, ["--branch", baseBranch]),
      "clone"
    );

    // Create the local retest branch from the base branch
    const repoGit = simpleGit(repoPath);
    await repoGit.checkoutLocalBranch(info.branch);
    console.warn(
      `[RepoManager] Created local branch '${info.branch}' from '${info.baseBranch}'`
    );
    actualBranch = info.branch;
  } else if (info.useDefaultBranch === true) {
    console.warn(
      `[RepoManager] Cloning with fallback to default branch enabled`
    );
    try {
      await retryNetworkOp(
        () => git.clone(cloneUrl, repoPath, ["--branch", info.branch]),
        "clone"
      );
    } catch (cloneError) {
      if (isBranchNotFoundError(cloneError)) {
        console.warn(
          `[RepoManager] Branch '${info.branch}' not found, cloning default branch`
        );
        await retryNetworkOp(() => git.clone(cloneUrl, repoPath), "clone");
        const repoGit = simpleGit(repoPath);
        actualBranch = await getDefaultBranch(repoGit);
        console.warn(`[RepoManager] Using default branch: ${actualBranch}`);
      } else {
        throw cloneError;
      }
    }
  } else {
    await retryNetworkOp(
      () => git.clone(cloneUrl, repoPath, ["--branch", info.branch]),
      "clone"
    );
  }

  if (info.commitSha !== undefined && info.commitSha !== "") {
    await checkoutCommitSha(
      simpleGit(repoPath),
      info.commitSha,
      info.useDefaultBranch === true
    );
  }

  return actualBranch;
}
