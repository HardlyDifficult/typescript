#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Auto-commits and pushes any uncommitted changes (e.g., from lint/format auto-fix or shared-config sync).
 * Exits 0 if no changes. Exits 1 after successfully committing and pushing (to trigger CI re-run).
 *
 * Usage:
 *   npx auto-commit-fixes
 *
 * Environment:
 *   BRANCH             Optional. Explicit branch name.
 *   GITHUB_HEAD_REF    Used automatically in pull request workflows.
 *   GITHUB_REF_NAME    Used automatically in branch workflows.
 *   GH_PAT             Optional. A GitHub PAT used for push so the commit triggers a new CI run.
 *   GITHUB_REPOSITORY  Optional. owner/repo, used with GH_PAT when rewriting origin.
 */

import { execSync } from "child_process";

import { duration } from "@hardlydifficult/date-time";

const DEFAULT_AUTHOR_EMAIL = "github-actions[bot]@users.noreply.github.com";
const DEFAULT_AUTHOR_NAME = "github-actions[bot]";
const DEFAULT_COMMIT_MESSAGE = "style: auto-fix linting issues";
const DEFAULT_MAX_PUSH_ATTEMPTS = 4;
const DEFAULT_REMOTE = "origin";

export interface AutoCommitFixesOptions {
  authorEmail?: string;
  authorName?: string;
  branch?: string;
  commitMessage?: string;
  maxPushAttempts?: number;
  remote?: string;
  repository?: string;
  token?: string;
}

export interface AutoCommitFixesResult {
  branch: string;
  committed: boolean;
  pushed: boolean;
  rerunRequired: boolean;
}

function exec(command: string, ignoreError = false): string {
  console.log(`$ ${command}`);
  try {
    return execSync(command, { encoding: "utf-8", stdio: "pipe" }).trim();
  } catch (error) {
    if (ignoreError) {
      return "";
    }
    throw error;
  }
}

function hasChanges(): boolean {
  return exec("git status --short").length > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pushWithRetry(
  branch: string,
  remote: string,
  maxPushAttempts: number
): Promise<void> {
  for (let attempt = 1; attempt <= maxPushAttempts; attempt++) {
    exec(`git pull --rebase ${remote} ${branch}`, true);

    try {
      exec(`git push ${remote} HEAD:${branch}`);
      return;
    } catch {
      if (attempt === maxPushAttempts) {
        throw new Error(
          `Failed to push after ${String(maxPushAttempts)} attempts`
        );
      }

      const delaySeconds = Math.pow(2, attempt);
      const delay = duration({ seconds: delaySeconds });
      console.log(`Push failed, retrying in ${String(delaySeconds)}s...`);
      await sleep(delay);
    }
  }
}

/**
 * Resolve the target branch from CI environment variables.
 */
export function resolveCiBranch(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  return env.BRANCH ?? env.GITHUB_HEAD_REF ?? env.GITHUB_REF_NAME;
}

/**
 * Commit and push working tree fixes, returning whether CI should be re-run.
 */
export async function autoCommitFixes(
  options: AutoCommitFixesOptions = {}
): Promise<AutoCommitFixesResult> {
  const branch = options.branch ?? resolveCiBranch();
  if (branch === undefined || branch === "") {
    throw new Error(
      "Could not determine the branch to push. Set BRANCH, GITHUB_HEAD_REF, or GITHUB_REF_NAME."
    );
  }

  if (!hasChanges()) {
    console.log("No changes detected. Nothing to commit.");
    return {
      branch,
      committed: false,
      pushed: false,
      rerunRequired: false,
    };
  }

  console.log("Changes detected. Committing auto-fixes...");

  const remote = options.remote ?? DEFAULT_REMOTE;
  const token = options.token ?? process.env.GH_PAT;
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY;
  if (
    token !== undefined &&
    token !== "" &&
    repository !== undefined &&
    repository !== ""
  ) {
    exec(
      `git remote set-url ${remote} https://x-access-token:${token}@github.com/${repository}.git`
    );
  }

  exec(
    `git config --local user.email "${options.authorEmail ?? DEFAULT_AUTHOR_EMAIL}"`
  );
  exec(
    `git config --local user.name "${options.authorName ?? DEFAULT_AUTHOR_NAME}"`
  );

  const stashOutput = exec(
    'git stash push --include-untracked --message "ci-auto-fix"',
    true
  );
  exec(`git pull --rebase ${remote} ${branch}`, true);

  if (!stashOutput.includes("No local changes to save")) {
    exec("git stash pop", true);
  }

  exec("git add -A");
  exec(
    `git commit -m ${JSON.stringify(options.commitMessage ?? DEFAULT_COMMIT_MESSAGE)}`
  );

  await pushWithRetry(
    branch,
    remote,
    options.maxPushAttempts ?? DEFAULT_MAX_PUSH_ATTEMPTS
  );

  console.log("");
  console.log("Auto-fix commit pushed successfully.");
  console.log("This build will fail so the next CI run validates the fixes.");

  return {
    branch,
    committed: true,
    pushed: true,
    rerunRequired: true,
  };
}

/**
 * CLI entrypoint for auto-commit-fixes.
 */
export async function runAutoCommitFixesCli(): Promise<number> {
  try {
    const result = await autoCommitFixes();
    return result.rerunRequired ? 1 : 0;
  } catch (error) {
    console.error(
      "auto-commit-fixes failed:",
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

if (require.main === module) {
  void runAutoCommitFixesCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
