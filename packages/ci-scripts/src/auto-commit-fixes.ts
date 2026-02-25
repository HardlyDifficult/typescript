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
 *   BRANCH  - Required. The branch to push to (e.g., from github.head_ref || github.ref_name).
 *   GH_PAT  - Optional. A GitHub PAT used for push so the commit triggers a new CI run.
 *             (Pushes with the default GITHUB_TOKEN do not trigger workflows.)
 */

import { execSync } from "child_process";

import { secondsToMilliseconds } from "@hardlydifficult/date-time";

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
  try {
    execSync("git diff --exit-code", { stdio: "pipe" });
  } catch {
    return true;
  }
  // Also check for untracked files (git diff only sees tracked files)
  const untracked = execSync("git ls-files --others --exclude-standard", {
    encoding: "utf-8",
    stdio: "pipe",
  }).trim();
  return untracked.length > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pushWithRetry(branch: string): Promise<void> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    exec(`git pull --rebase origin ${branch}`, true);
    try {
      exec(`git push origin HEAD:${branch}`);
      return;
    } catch {
      if (attempt === 4) {
        throw new Error("Failed to push after 4 attempts");
      }
      const delay = secondsToMilliseconds(Math.pow(2, attempt));
      console.log(
        `Push failed, retrying in ${String(delay / secondsToMilliseconds(1))}s...`
      );
      await sleep(delay);
    }
  }
}

async function main(): Promise<void> {
  const branch = process.env.BRANCH;
  if (branch === undefined || branch === "") {
    console.error("Error: BRANCH environment variable is required.");
    /* eslint-disable no-template-curly-in-string */
    console.error(
      "Set it in your CI workflow: BRANCH: ${{ github.head_ref || github.ref_name }}"
    );
    /* eslint-enable no-template-curly-in-string */
    process.exit(1);
  }

  if (!hasChanges()) {
    console.log("No changes detected. Nothing to commit.");
    return;
  }

  console.log("Changes detected. Committing auto-fixes...");

  // Use PAT for push so the commit triggers a new CI run
  // (pushes with the default GITHUB_TOKEN do not trigger workflows)
  const ghPat = process.env.GH_PAT;
  const repo = process.env.GITHUB_REPOSITORY;
  if (ghPat !== undefined && ghPat !== "" && repo !== undefined) {
    exec(
      `git remote set-url origin https://x-access-token:${ghPat}@github.com/${repo}.git`
    );
  }

  exec(
    'git config --local user.email "github-actions[bot]@users.noreply.github.com"'
  );
  exec('git config --local user.name "github-actions[bot]"');

  // Stash, pull latest, reapply
  exec("git stash");
  exec(`git pull --rebase origin ${branch}`, true);
  exec("git stash pop", true);

  exec("git add -A");
  exec('git commit -m "style: auto-fix linting issues"');

  await pushWithRetry(branch);

  console.log("");
  console.log("Auto-fix commit pushed successfully.");
  console.log("This build will fail so the next CI run validates the fixes.");
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error("auto-commit-fixes failed:", err);
  process.exit(1);
});
