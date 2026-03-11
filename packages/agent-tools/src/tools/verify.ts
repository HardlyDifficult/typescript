/**
 * Purpose-built verification logic for checking code changes.
 *
 * Runs configured steps (install, build, lint, format) or falls back to
 * build + typecheck. Called automatically after the agent completes its
 * changes, before the PR is submitted.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { stripAnsi } from "@hardlydifficult/text";

import { VERIFY_TIMEOUT } from "../config.js";

const execFileAsync = promisify(execFile);

/** Max error lines to show before truncating. */
const MAX_ERROR_LINES = 20;

/** TypeScript error pattern. */
const TS_ERROR_RE = /error TS\d+:/;

/**
 * Count TypeScript errors in output.
 */
function countTsErrors(output: string): number {
  let count = 0;
  for (const line of output.split("\n")) {
    if (TS_ERROR_RE.test(line)) {
      count++;
    }
  }
  return count;
}

/**
 * Extract error lines from output, limited to MAX_ERROR_LINES.
 */
function extractErrors(output: string): { lines: string[]; total: number } {
  const errorLines = output
    .split("\n")
    .filter((line) => TS_ERROR_RE.test(line));
  return {
    lines: errorLines.slice(0, MAX_ERROR_LINES),
    total: errorLines.length,
  };
}

/** Check configuration for each verification type. */
interface CheckConfig {
  command: string;
  args: string[];
  label: string;
}

function stepToCheckConfig(step: string): CheckConfig {
  if (step === "install") {
    return { command: "npm", args: ["install"], label: "npm install" };
  }
  if (step === "upgrade") {
    return {
      command: "npm",
      args: ["update"],
      label: "npm update (upgrade packages)",
    };
  }
  // Support workspace-scoped steps: "-w packages/foo script"
  const wsMatch = /^-w\s+(\S+)\s+(.+)$/.exec(step);
  if (wsMatch) {
    return {
      command: "npm",
      args: ["run", wsMatch[2], "-w", wsMatch[1]],
      label: `${wsMatch[2]} (${wsMatch[1]})`,
    };
  }
  return { command: "npm", args: ["run", step], label: step };
}

function getCheckConfig(check: string): CheckConfig {
  switch (check) {
    case "build":
      return {
        command: "npm",
        args: ["run", "build"],
        label: "TypeScript build",
      };
    case "typecheck":
      return {
        command: "npx",
        args: ["tsc", "--noEmit"],
        label: "TypeScript typecheck",
      };
    default:
      throw new Error(`Unknown check: ${check}`);
  }
}

/**
 * Run a single check and return the formatted result.
 */
async function runCheck(
  config: CheckConfig,
  repoPath: string
): Promise<string> {
  try {
    await execFileAsync(config.command, config.args, {
      cwd: repoPath,
      timeout: VERIFY_TIMEOUT,
      env: { ...process.env, FORCE_COLOR: "0" },
      // On Windows, npm is a .cmd script and requires shell resolution
      shell: process.platform === "win32",
    });
    return `PASS: ${config.label}`;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    const stdout = (error as { stdout?: string }).stdout ?? "";
    const output = stripAnsi(`${stdout}\n${stderr}`.trim());

    const errorCount = countTsErrors(output);

    if (errorCount > 0) {
      const { lines, total } = extractErrors(output);
      let result = `FAIL: ${config.label}\n${lines.join("\n")}`;
      if (total > MAX_ERROR_LINES) {
        result += `\n[... and ${String(total - MAX_ERROR_LINES)} more errors]`;
      }
      result += `\n[${String(errorCount)} error(s) found]`;
      return result;
    }

    // Non-TS error (e.g. npm script failure, timeout)
    if (!output) {
      const parts: string[] = [];
      const { code } = error as { code?: number | string };
      const { signal } = error as { signal?: string };
      const { killed } = error as { killed?: boolean };
      if (killed === true) {
        parts.push("process killed (likely timeout)");
      }
      if (signal !== undefined && signal !== "") {
        parts.push(`signal: ${signal}`);
      }
      if (code === "ENOENT") {
        parts.push(`command not found: '${config.command}'`);
        parts.push(`cwd: ${repoPath}`);
        const pathEnv = process.env.PATH ?? "(not set)";
        console.error(
          `[verify] ENOENT for '${config.command}' — PATH: ${pathEnv}, cwd: ${repoPath}`
        );
      } else if (code !== undefined) {
        parts.push(`exit code: ${String(code)}`);
      }
      const detail = parts.length > 0 ? parts.join(", ") : "no output captured";
      return `FAIL: ${config.label}\n(${detail})`;
    }
    const truncated =
      output.length > 2000
        ? `${output.slice(0, 2000)}\n[output truncated]`
        : output;
    return `FAIL: ${config.label}\n${truncated}`;
  }
}

/**
 * Run all verification steps and return the combined output.
 *
 * When verifySteps is provided, runs those steps in order (stopping early on
 * install failure). When not provided, falls back to build + typecheck.
 */
export async function runVerification(
  repoPath: string,
  verifySteps?: string[]
): Promise<{ output: string; hasFailures: boolean }> {
  const results: string[] = [];
  let hasFailures = false;

  if (verifySteps) {
    for (const step of verifySteps) {
      const config = stepToCheckConfig(step);
      const result = await runCheck(config, repoPath);
      results.push(result);

      if (result.startsWith("FAIL:")) {
        hasFailures = true;
      }

      // Stop early if npm install fails — remaining steps will also fail
      if (step === "install" && result.startsWith("FAIL:")) {
        break;
      }
    }
  } else {
    // Legacy fallback: install first, then build + typecheck
    const installConfig = stepToCheckConfig("install");
    const installResult = await runCheck(installConfig, repoPath);
    results.push(installResult);

    if (installResult.startsWith("FAIL:")) {
      hasFailures = true;
    } else {
      for (const check of ["build", "typecheck"]) {
        const config = getCheckConfig(check);
        const result = await runCheck(config, repoPath);
        results.push(result);

        if (result.startsWith("FAIL:")) {
          hasFailures = true;
        }
      }
    }
  }

  return { output: results.join("\n\n"), hasFailures };
}
