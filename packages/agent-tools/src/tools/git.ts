/**
 * Git diff and revert tools for the coding agent.
 *
 * Allows the agent to inspect uncommitted changes and revert files or the
 * entire working tree back to a known state (main branch or last commit).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ToolMap } from "@hardlydifficult/ai";
import { z } from "zod";

const execFileAsync = promisify(execFile);

/** Max diff output size before truncating. */
const MAX_DIFF_BYTES = 80_000;

export interface GitToolOptions {
  /** Absolute path to the repository on disk. */
  repoPath: string;
}

/**
 * Run a git command and return stdout, or an error string.
 */
async function gitExec(
  args: string[],
  repoPath: string
): Promise<{ ok: true; stdout: string } | { ok: false; error: string }> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: repoPath,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: msg };
  }
}

/**
 * Detect the default branch name (main or master) from origin.
 */
async function getDefaultBranch(repoPath: string): Promise<string> {
  // Try origin/main first, then origin/master
  const result = await gitExec(
    ["rev-parse", "--verify", "origin/main"],
    repoPath
  );
  if (result.ok) {
    return "origin/main";
  }

  const masterResult = await gitExec(
    ["rev-parse", "--verify", "origin/master"],
    repoPath
  );
  if (masterResult.ok) {
    return "origin/master";
  }

  // Last resort: try local main/master
  const localMain = await gitExec(["rev-parse", "--verify", "main"], repoPath);
  if (localMain.ok) {
    return "main";
  }

  return "master";
}

/**
 * Create git diff and revert tools bound to a specific repository.
 */
export function createGitTools(options: GitToolOptions): ToolMap {
  const { repoPath } = options;

  return {
    diff: {
      description:
        "Show the git diff of current changes. Compare against the main branch (default) or the last commit (HEAD). " +
        "Optionally scope to a specific file or directory.",
      inputSchema: z.object({
        against: z
          .enum(["main", "last_commit"])
          .default("main")
          .describe(
            "What to diff against: 'main' (default branch) or 'last_commit' (HEAD)."
          ),
        path: z
          .string()
          .optional()
          .describe("Optional file or directory path to scope the diff to."),
      }),
      execute: async ({
        against,
        path,
      }: {
        against: "main" | "last_commit";
        path?: string;
      }) => {
        let ref: string;

        if (against === "main") {
          ref = await getDefaultBranch(repoPath);
        } else {
          ref = "HEAD";
        }

        // Build the diff command
        // For 'main': show all changes between main and working tree (staged + unstaged)
        // For 'last_commit': show uncommitted changes vs HEAD
        const args = ["diff", ref];
        if (path !== undefined && path !== "") {
          args.push("--", path);
        }

        const result = await gitExec(args, repoPath);
        if (!result.ok) {
          return `Error running git diff: ${result.error}`;
        }

        const diff = result.stdout.trim();
        if (diff === "") {
          const scope =
            path !== undefined && path !== "" ? ` for '${path}'` : "";
          return `No differences found${scope} when comparing against ${against === "main" ? "the main branch" : "the last commit"}.`;
        }

        // Also get a stat summary
        const statArgs = ["diff", "--stat", ref];
        if (path !== undefined && path !== "") {
          statArgs.push("--", path);
        }
        const statResult = await gitExec(statArgs, repoPath);
        const stat = statResult.ok ? statResult.stdout.trim() : "";

        let output = "";
        if (stat) {
          output += `[Summary]\n${stat}\n\n`;
        }
        output += `[Diff vs ${against === "main" ? "main branch" : "last commit"}]\n${diff}`;

        if (output.length > MAX_DIFF_BYTES) {
          output = `${output.slice(0, MAX_DIFF_BYTES)}\n\n[diff truncated — use path parameter to scope to specific files]`;
        }

        return output;
      },
    },

    revert: {
      description:
        "Revert file(s) to a clean state. Discards uncommitted changes by restoring from the main branch or the last commit (HEAD). " +
        "Can target a specific file or directory, or revert the entire repository.",
      inputSchema: z.object({
        to: z
          .enum(["main", "last_commit"])
          .default("last_commit")
          .describe(
            "What to revert to: 'main' (default branch) or 'last_commit' (HEAD)."
          ),
        path: z
          .string()
          .optional()
          .describe(
            "File or directory to revert. Omit to revert the entire repository."
          ),
      }),
      execute: async ({
        to,
        path,
      }: {
        to: "main" | "last_commit";
        path?: string;
      }) => {
        let ref: string;

        if (to === "main") {
          ref = await getDefaultBranch(repoPath);
        } else {
          ref = "HEAD";
        }

        if (path !== undefined && path !== "") {
          // Revert specific path: checkout from ref
          const result = await gitExec(["checkout", ref, "--", path], repoPath);
          if (!result.ok) {
            return `Error reverting '${path}': ${result.error}`;
          }

          // Also remove any untracked files in that path
          const cleanResult = await gitExec(
            ["clean", "-fd", "--", path],
            repoPath
          );

          const target = to === "main" ? "the main branch" : "the last commit";
          let msg = `Reverted '${path}' to ${target}.`;
          if (cleanResult.ok && cleanResult.stdout.trim()) {
            msg += `\nCleaned untracked files:\n${cleanResult.stdout.trim()}`;
          }
          return msg;
        }

        // Revert entire repo
        // 1. Reset index and working tree to ref
        const resetResult = await gitExec(
          ["checkout", ref, "--", "."],
          repoPath
        );
        if (!resetResult.ok) {
          return `Error reverting repository: ${resetResult.error}`;
        }

        // 2. Remove untracked files
        const cleanResult = await gitExec(["clean", "-fd"], repoPath);

        const target = to === "main" ? "the main branch" : "the last commit";
        let msg = `Reverted entire repository to ${target}.`;
        if (cleanResult.ok && cleanResult.stdout.trim()) {
          msg += `\nCleaned untracked files:\n${cleanResult.stdout.trim()}`;
        }

        return msg;
      },
    },
  };
}
