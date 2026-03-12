/**
 * Tests for the auto-commit-fixes `require.main === module` CLI entry guard.
 *
 * This test file is isolated so that auto-commit-fixes.ts is imported fresh
 * (not from other test files' cached module).  We set require.main = module
 * so the guard evaluates to true and the CLI entry block executes.
 */
import { describe, expect, it, vi, beforeAll } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));
vi.mock("@hardlydifficult/date-time", () => ({
  duration: vi.fn().mockReturnValue(100),
}));

describe("auto-commit-fixes CLI main guard", () => {
  it("executes the require.main guard block when require.main === module", async () => {
    // In vitest's CJS polyfill all modules share the same `module` proxy object.
    // Setting require.main = module makes `require.main === module` evaluate to
    // true inside any module imported AFTER this assignment.
    const req = require as NodeJS.Require & {
      main: NodeModule | null | undefined;
    };
    const originalMain = req.main;
    req.main = module; // make require.main === module true

    // Ensure no branch env var so runAutoCommitFixesCli returns 1 quickly
    const originalEnv = process.env;
    process.env = {};

    // Use vi.resetModules() so the module is re-evaluated fresh with
    // require.main set to our module
    vi.resetModules();

    try {
      // Re-import the module; the `if (require.main === module)` guard
      // will execute, calling runAutoCommitFixesCli() which will fail
      // (no branch) and set process.exitCode = 1
      await import("../src/auto-commit-fixes.js");

      // Give the async void expression a chance to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The CLI ran and set exitCode to 1 (no branch)
      expect(process.exitCode).toBe(1);
    } finally {
      req.main = originalMain;
      process.env = originalEnv;
      process.exitCode = 0; // reset for other tests
      vi.resetModules();
    }
  });
});
