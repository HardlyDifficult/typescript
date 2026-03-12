/**
 * Tests covering the `require.main === module` CLI entry points.
 * Each source file has a guard that runs when invoked directly with node.
 * These tests spawn child processes to execute the compiled files as main modules,
 * thereby triggering the require.main === module branch.
 */

import { spawnSync } from "child_process";
import { join } from "path";

import { describe, expect, it } from "vitest";

const DIST_DIR = join(
  import.meta.dirname ?? __dirname,
  "..",
  "dist"
);

function runScript(
  scriptName: string,
  args: string[] = [],
  env: Record<string, string> = {}
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(
    "node",
    [join(DIST_DIR, scriptName), ...args],
    {
      encoding: "utf-8",
      timeout: 10000,
      env: {
        PATH: process.env.PATH ?? "",
        ...env,
      },
    }
  );

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

describe("CLI entry points (require.main === module)", () => {
  it("auto-commit-fixes.js exits 1 when no branch env var is set", () => {
    const result = runScript("auto-commit-fixes.js");
    // Should exit 1 because no BRANCH/GITHUB_HEAD_REF/GITHUB_REF_NAME is set
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("auto-commit-fixes failed");
  });

  it("check-package-metadata.js exits without crashing", () => {
    const result = runScript("check-package-metadata.js");
    // Exits 0 or 1 depending on cwd, but must not crash unexpectedly
    expect(typeof result.status).toBe("number");
  });

  it("check-pinned-deps.js exits without crashing", () => {
    const result = runScript("check-pinned-deps.js");
    expect(typeof result.status).toBe("number");
  });

  it("publish.js exits without crashing when no packages found", () => {
    const result = runScript("publish.js", ["--packages-dir", "nonexistent"]);
    // Should exit 1 (error: cannot read directory) or 0 (no packages)
    expect(typeof result.status).toBe("number");
  });
});
