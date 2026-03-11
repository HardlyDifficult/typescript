/**
 * Commit tool for the coding agent.
 *
 * Allows the agent to checkpoint its work mid-session by committing changes
 * to git. Before committing, runs the full verification pipeline (install,
 * build, lint, etc.) to ensure the commit is clean. This encourages
 * incremental, step-by-step work.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ToolMap } from "@hardlydifficult/ai";
import { z } from "zod";

import { runVerification } from "./verify.js";

const execFileAsync = promisify(execFile);

/** Max length for the commit title line. */
const MAX_TITLE_LENGTH = 72;

/** Max length for a single description line. */
const MAX_DESCRIPTION_LINE = 200;

export interface CommitToolOptions {
  /** Absolute path to the repository on disk. */
  repoPath: string;
  /** Verify steps from repos.json (e.g. ["install", "build", "lint:fix"]). */
  verifySteps?: string[];
}

/**
 * Create a commit tool bound to a specific repository.
 */
export function createCommitTools(options: CommitToolOptions): ToolMap {
  const { repoPath, verifySteps } = options;

  return {
    commit: {
      description:
        "Commit the current changes to git. Use this to checkpoint your work after completing " +
        "a logical step. Before the commit is created, a full verification pipeline runs " +
        "(install, build, lint, etc.) — the commit only succeeds if all checks pass.\n\n" +
        "Work step-by-step: make a focused change, verify it compiles and passes lint, " +
        "then commit before moving on to the next change. This keeps each commit small and reviewable.",
      inputSchema: z.object({
        title: z
          .string()
          .max(MAX_TITLE_LENGTH)
          .describe(
            `Short summary of what this commit does (max ${String(MAX_TITLE_LENGTH)} chars). ` +
              "Use imperative mood, e.g. 'Add user auth endpoint' not 'Added user auth endpoint'."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "Optional longer explanation of why the change was made. " +
              "Keep it brief — one or two sentences is usually enough."
          ),
      }),
      execute: async ({
        title,
        description,
      }: {
        title: string;
        description?: string;
      }) => {
        // 1. Check for changes
        let statusOutput: string;
        try {
          const { stdout } = await execFileAsync(
            "git",
            ["status", "--porcelain"],
            { cwd: repoPath }
          );
          statusOutput = stdout.trim();
        } catch (error) {
          return `Error: Failed to check git status — ${error instanceof Error ? error.message : String(error)}`;
        }

        if (!statusOutput) {
          return "No changes to commit. Make some changes first, then try again.";
        }

        const changedFiles = statusOutput
          .split("\n")
          .map((line) => line.slice(3).trim())
          .filter(Boolean);

        // 2. Run verification before committing
        const checksLabel = verifySteps
          ? verifySteps.join(" → ")
          : "install → build → typecheck";
        const verifyHeader = `**Running verification before commit...**\nChecks: ${checksLabel}\n`;

        const verifyResult = await runVerification(repoPath, verifySteps);

        if (verifyResult.hasFailures) {
          return `${verifyHeader}\n${verifyResult.output}\n\nCommit aborted — fix the errors above before committing. Once the issues are resolved, call commit again.`;
        }

        // 3. Stage all changes
        try {
          await execFileAsync("git", ["add", "-A"], { cwd: repoPath });
        } catch (error) {
          return `Error: Failed to stage changes — ${error instanceof Error ? error.message : String(error)}`;
        }

        // 4. Build the commit message
        const sanitizedTitle = title.slice(0, MAX_TITLE_LENGTH).trim();
        let commitMessage = sanitizedTitle;
        if (description !== undefined && description !== "") {
          const sanitizedDesc = description
            .split("\n")
            .map((line) => line.slice(0, MAX_DESCRIPTION_LINE))
            .join("\n")
            .trim();
          commitMessage = `${sanitizedTitle}\n\n${sanitizedDesc}`;
        }

        // 5. Create the commit
        try {
          await execFileAsync("git", ["commit", "-m", commitMessage], {
            cwd: repoPath,
            env: {
              ...process.env,
              GIT_AUTHOR_NAME: "HardlyDifficult",
              GIT_AUTHOR_EMAIL: "HardlyDifficult@users.noreply.github.com",
              GIT_COMMITTER_NAME: "HardlyDifficult",
              GIT_COMMITTER_EMAIL: "HardlyDifficult@users.noreply.github.com",
            },
          });
        } catch (error) {
          return `Error: Failed to create commit — ${error instanceof Error ? error.message : String(error)}`;
        }

        // 6. Get the commit hash for confirmation
        let commitHash = "";
        try {
          const { stdout } = await execFileAsync(
            "git",
            ["rev-parse", "--short", "HEAD"],
            { cwd: repoPath }
          );
          commitHash = stdout.trim();
        } catch {
          // Non-critical — just skip the hash in the output
        }

        const fileList = changedFiles.slice(0, 10).join(", ");
        const moreFiles =
          changedFiles.length > 10
            ? ` and ${String(changedFiles.length - 10)} more`
            : "";

        const hashLabel = commitHash !== "" ? `(${commitHash}) ` : "";
        const fileCount = String(changedFiles.length);
        const fileSuffix = changedFiles.length !== 1 ? "s" : "";

        return `${verifyHeader}\n${verifyResult.output}\n\nCommitted ${hashLabel}"${sanitizedTitle}"\n${fileCount} file${fileSuffix}: ${fileList}${moreFiles}`;
      },
    },
  };
}
