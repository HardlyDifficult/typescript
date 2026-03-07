import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const simpleGitFactory = vi.fn();

vi.mock("simple-git", async () => {
  const actual = await vi.importActual<typeof import("simple-git")>(
    "simple-git"
  );

  return {
    ...actual,
    simpleGit: simpleGitFactory,
  };
});

describe("GitYamlStore", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    simpleGitFactory.mockReset();
  });

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((directory) =>
        rm(directory, { recursive: true, force: true })
      )
    );
    tempDirs.length = 0;
  });

  it("writes file results under root/owner/repo by default", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await mkdtemp(
      path.join(os.tmpdir(), "repo-processor-results-")
    );
    tempDirs.push(localPath);

    const store = new GitYamlStore({
      sourceRepo: {
        owner: "owner",
        name: "repo",
        fullName: "owner/repo",
      },
      resultsRepo: {
        owner: "owner",
        name: "results",
        fullName: "owner/results",
      },
      localPath,
      root: "repos",
    });

    await store.writeFileResult("src/index.ts", "sha1", { ok: true });

    const outputPath = path.join(
      localPath,
      "repos",
      "owner",
      "repo",
      "src",
      "index.ts.yml"
    );
    const content = await readFile(outputPath, "utf-8");
    expect(content).toContain("sha: sha1");
    expect(content).toContain("ok: true");
  });

  it("falls back to local git config for commit identity and branch", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await mkdtemp(
      path.join(os.tmpdir(), "repo-processor-store-")
    );
    tempDirs.push(localPath);
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = {
      branchLocal: vi.fn().mockResolvedValue({
        current: "main",
        all: ["main"],
      }),
      checkout: vi.fn().mockResolvedValue(undefined),
      checkoutBranch: vi.fn().mockResolvedValue(undefined),
      checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
      pull: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn((key: string) =>
        Promise.resolve({
          value: key === "user.name" ? "Nick" : "nick@example.com",
        })
      ),
      status: vi.fn().mockResolvedValue({
        files: [{ path: "repos/owner/repo/src/index.ts.yml" }],
      }),
      addConfig: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      push: vi.fn().mockResolvedValue(undefined),
      raw: vi.fn().mockResolvedValue("refs/remotes/origin/main"),
      rebase: vi.fn().mockResolvedValue(undefined),
    };
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore({
      sourceRepo: {
        owner: "owner",
        name: "repo",
        fullName: "owner/repo",
      },
      resultsRepo: {
        owner: "owner",
        name: "results",
        fullName: "owner/results",
      },
      localPath,
      root: "repos",
    });

    await store.ensureReady();
    await store.commitBatch("owner/repo", 1);

    expect(git.pull).toHaveBeenCalledWith("origin", "main");
    expect(git.addConfig).toHaveBeenCalledWith("user.email", "nick@example.com");
    expect(git.addConfig).toHaveBeenCalledWith("user.name", "Nick");
    expect(git.push).toHaveBeenCalledWith("origin", "main");
  });
});
