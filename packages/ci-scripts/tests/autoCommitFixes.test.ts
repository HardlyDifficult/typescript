import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  autoCommitFixes,
  resolveCiBranch,
  runAutoCommitFixesCli,
} from "../src/auto-commit-fixes.js";

// Mock child_process execSync
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

// Mock @hardlydifficult/date-time duration
vi.mock("@hardlydifficult/date-time", () => ({
  duration: vi.fn(({ seconds }: { seconds: number }) => seconds * 1000),
}));

import { execSync } from "child_process";

const mockExecSync = vi.mocked(execSync);

describe("resolveCiBranch", () => {
  it("returns undefined when no env vars are set", () => {
    expect(resolveCiBranch({})).toBeUndefined();
  });

  it("returns BRANCH when set", () => {
    expect(resolveCiBranch({ BRANCH: "my-branch" })).toBe("my-branch");
  });

  it("returns GITHUB_HEAD_REF when BRANCH is not set", () => {
    expect(resolveCiBranch({ GITHUB_HEAD_REF: "pr-branch" })).toBe("pr-branch");
  });

  it("returns GITHUB_REF_NAME as fallback", () => {
    expect(resolveCiBranch({ GITHUB_REF_NAME: "main" })).toBe("main");
  });
});

describe("autoCommitFixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no changes (git status --short returns empty string)
    mockExecSync.mockReturnValue("");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when no branch can be determined", async () => {
    // Remove all branch-related env vars
    const originalEnv = process.env;
    process.env = {};

    try {
      await expect(autoCommitFixes({ branch: "" })).rejects.toThrow(
        "Could not determine the branch to push"
      );
    } finally {
      process.env = originalEnv;
    }
  });

  it("throws when branch is undefined and no env vars set", async () => {
    const originalEnv = process.env;
    process.env = {};

    try {
      await expect(autoCommitFixes()).rejects.toThrow(
        "Could not determine the branch to push"
      );
    } finally {
      process.env = originalEnv;
    }
  });

  it("returns no-op result when there are no changes", async () => {
    // git status --short returns empty => no changes
    mockExecSync.mockReturnValue("");

    const result = await autoCommitFixes({ branch: "main" });

    expect(result).toEqual({
      branch: "main",
      committed: false,
      pushed: false,
      rerunRequired: false,
    });
  });

  it("commits and pushes when there are changes", async () => {
    let callCount = 0;
    mockExecSync.mockImplementation((command: string) => {
      // git status --short returns non-empty => has changes
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M some-file.ts";
      }
      // git stash push returns "No local changes to save" so we skip stash pop
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      callCount++;
      return "";
    });

    const result = await autoCommitFixes({ branch: "feature/test" });

    expect(result).toEqual({
      branch: "feature/test",
      committed: true,
      pushed: true,
      rerunRequired: true,
    });
  });

  it("uses token and repository to rewrite remote url", async () => {
    const execCalls: string[] = [];
    mockExecSync.mockImplementation((command: string) => {
      execCalls.push(command as string);
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts";
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      return "";
    });

    await autoCommitFixes({
      branch: "main",
      token: "mytoken",
      repository: "owner/repo",
    });

    const remoteCall = execCalls.find((c) => c.includes("git remote set-url"));
    expect(remoteCall).toContain(
      "https://x-access-token:mytoken@github.com/owner/repo.git"
    );
  });

  it("uses token and repository from environment variables", async () => {
    const execCalls: string[] = [];
    mockExecSync.mockImplementation((command: string) => {
      execCalls.push(command as string);
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts";
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      return "";
    });

    const originalEnv = process.env;
    process.env = {
      ...process.env,
      GH_PAT: "envtoken",
      GITHUB_REPOSITORY: "envowner/envrepo",
    };

    try {
      await autoCommitFixes({ branch: "main" });

      const remoteCall = execCalls.find((c) =>
        c.includes("git remote set-url")
      );
      expect(remoteCall).toContain(
        "https://x-access-token:envtoken@github.com/envowner/envrepo.git"
      );
    } finally {
      process.env = originalEnv;
    }
  });

  it("does not rewrite remote when token is empty string", async () => {
    const execCalls: string[] = [];
    mockExecSync.mockImplementation((command: string) => {
      execCalls.push(command as string);
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts";
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      return "";
    });

    await autoCommitFixes({
      branch: "main",
      token: "",
      repository: "owner/repo",
    });

    const remoteCall = execCalls.find((c) => c.includes("git remote set-url"));
    expect(remoteCall).toBeUndefined();
  });

  it("does not rewrite remote when repository is empty string", async () => {
    const execCalls: string[] = [];
    mockExecSync.mockImplementation((command: string) => {
      execCalls.push(command as string);
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts";
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      return "";
    });

    await autoCommitFixes({
      branch: "main",
      token: "token",
      repository: "",
    });

    const remoteCall = execCalls.find((c) => c.includes("git remote set-url"));
    expect(remoteCall).toBeUndefined();
  });

  it("pops stash when stash output does not contain 'No local changes to save'", async () => {
    const execCalls: string[] = [];
    mockExecSync.mockImplementation((command: string) => {
      execCalls.push(command as string);
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts";
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "Saved working directory and index state WIP on main";
      }
      return "";
    });

    await autoCommitFixes({ branch: "main" });

    const stashPopCall = execCalls.find((c) => c.includes("git stash pop"));
    expect(stashPopCall).toBeTruthy();
  });

  it("uses custom options (authorEmail, authorName, commitMessage, remote, maxPushAttempts)", async () => {
    const execCalls: string[] = [];
    mockExecSync.mockImplementation((command: string) => {
      execCalls.push(command as string);
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts";
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      return "";
    });

    await autoCommitFixes({
      branch: "feature",
      authorEmail: "bot@example.com",
      authorName: "MyBot",
      commitMessage: "chore: automated fix",
      remote: "upstream",
      maxPushAttempts: 1,
    });

    expect(execCalls.some((c) => c.includes("bot@example.com"))).toBe(true);
    expect(execCalls.some((c) => c.includes("MyBot"))).toBe(true);
    expect(execCalls.some((c) => c.includes("chore: automated fix"))).toBe(
      true
    );
    expect(execCalls.some((c) => c.includes("upstream"))).toBe(true);
  });

  it("retries push on failure and eventually throws", async () => {
    let pushAttempts = 0;

    mockExecSync.mockImplementation((command: string) => {
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts";
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      if (typeof command === "string" && command.includes("git push")) {
        pushAttempts++;
        throw new Error("push failed");
      }
      return "";
    });

    await expect(
      autoCommitFixes({
        branch: "main",
        maxPushAttempts: 2,
      })
    ).rejects.toThrow("Failed to push after 2 attempts");

    expect(pushAttempts).toBe(2);
  }, 15000);

  it("resolves branch from process.env when not provided in options", async () => {
    mockExecSync.mockReturnValue("");

    const originalEnv = process.env;
    process.env = { ...process.env, BRANCH: "env-branch" };

    try {
      const result = await autoCommitFixes();
      expect(result.branch).toBe("env-branch");
    } finally {
      process.env = originalEnv;
    }
  });

  it("re-throws exec errors when ignoreError is false", async () => {
    // git config (ignoreError=false by default) throws => exec re-throws
    mockExecSync.mockImplementation((command: string) => {
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts"; // has changes
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      if (
        typeof command === "string" &&
        command.includes("git config --local user.email")
      ) {
        const err = new Error("git config failed");
        throw err;
      }
      return "";
    });

    await expect(autoCommitFixes({ branch: "main" })).rejects.toThrow(
      "git config failed"
    );
  });

  it("returns empty string when ignoreError=true and execSync throws", async () => {
    // Test the exec function's ignoreError=true code path (line 53: return "")
    // git pull --rebase is called with ignoreError=true
    mockExecSync.mockImplementation((command: string) => {
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return ""; // no changes
      }
      if (
        typeof command === "string" &&
        command.includes("git pull --rebase")
      ) {
        throw new Error("network error");
      }
      return "";
    });

    // No changes means we just return early - but the pull rebase in pushWithRetry uses ignoreError=true
    // Let's make it have changes and see the stash + pull rebase path
    // Actually - in the no-changes path, no pull is called
    // Let me force changes and let the pull throw (ignoreError=true => return "")
    mockExecSync.mockImplementation((command: string) => {
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts"; // has changes
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      if (
        typeof command === "string" &&
        command.includes("git pull --rebase")
      ) {
        // With ignoreError=true, exec should return "" and not re-throw
        throw new Error("network error");
      }
      return "";
    });

    // Should succeed because git pull --rebase with ignoreError=true ignores the error
    const result = await autoCommitFixes({ branch: "main" });
    expect(result.rerunRequired).toBe(true);
  });
});

describe("runAutoCommitFixesCli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when autoCommitFixes succeeds with no rerun required", async () => {
    mockExecSync.mockReturnValue("");
    const originalEnv = process.env;
    process.env = { ...process.env, BRANCH: "main" };

    try {
      const exitCode = await runAutoCommitFixesCli();
      expect(exitCode).toBe(0);
    } finally {
      process.env = originalEnv;
    }
  });

  it("returns 1 when autoCommitFixes succeeds with rerun required", async () => {
    mockExecSync.mockImplementation((command: string) => {
      if (
        typeof command === "string" &&
        command.includes("git status --short")
      ) {
        return "M file.ts";
      }
      if (typeof command === "string" && command.includes("git stash push")) {
        return "No local changes to save";
      }
      return "";
    });

    const originalEnv = process.env;
    process.env = { ...process.env, BRANCH: "main" };

    try {
      const exitCode = await runAutoCommitFixesCli();
      expect(exitCode).toBe(1);
    } finally {
      process.env = originalEnv;
    }
  });

  it("returns 1 and logs error when autoCommitFixes throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const originalEnv = process.env;
    process.env = {};

    try {
      const exitCode = await runAutoCommitFixesCli();
      expect(exitCode).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        "auto-commit-fixes failed:",
        expect.stringContaining("Could not determine the branch")
      );
    } finally {
      process.env = originalEnv;
      consoleSpy.mockRestore();
    }
  });

  it("handles non-Error thrown values", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Force a non-Error throw by making execSync throw a non-Error
    mockExecSync.mockImplementation(() => {
      throw "string error";
    });

    const originalEnv = process.env;
    process.env = { ...process.env, BRANCH: "main" };

    try {
      // git status --short will throw, causing autoCommitFixes to throw non-Error
      const exitCode = await runAutoCommitFixesCli();
      expect(exitCode).toBe(1);
    } finally {
      process.env = originalEnv;
      consoleSpy.mockRestore();
    }
  });
});
