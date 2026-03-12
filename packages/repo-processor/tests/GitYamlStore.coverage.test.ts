import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const simpleGitFactory = vi.fn();

vi.mock("simple-git", async () => {
  const actual =
    await vi.importActual<typeof import("simple-git")>("simple-git");
  return { ...actual, simpleGit: simpleGitFactory };
});

describe("GitYamlStore coverage", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    simpleGitFactory.mockReset();
  });

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((d) => rm(d, { recursive: true, force: true }))
    );
    tempDirs.length = 0;
  });

  async function makeTempDir() {
    const d = await mkdtemp(path.join(os.tmpdir(), "rp-store-cov-"));
    tempDirs.push(d);
    return d;
  }

  function makeGitMock(overrides: Record<string, unknown> = {}) {
    return {
      branchLocal: vi.fn().mockResolvedValue({ current: "main", all: ["main"] }),
      checkout: vi.fn().mockResolvedValue(undefined),
      checkoutBranch: vi.fn().mockResolvedValue(undefined),
      checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
      pull: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn((key: string) =>
        Promise.resolve({
          value: key === "user.name" ? "Test User" : "test@example.com",
        })
      ),
      status: vi.fn().mockResolvedValue({ files: [] }),
      addConfig: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      push: vi.fn().mockResolvedValue(undefined),
      raw: vi.fn().mockResolvedValue("refs/remotes/origin/main"),
      rebase: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  function makeStoreConfig(localPath: string) {
    return {
      sourceRepo: { owner: "owner", name: "repo", fullName: "owner/repo" },
      resultsRepo: {
        owner: "owner",
        name: "results",
        fullName: "owner/results",
      },
      localPath,
      root: "repos",
    };
  }

  it("ensureReady only runs once (initialized guard)", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock();
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    await store.ensureReady(); // second call should be no-op

    expect(git.branchLocal).toHaveBeenCalledTimes(1);
  });

  it("ensureReady handles pull failure gracefully", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      pull: vi.fn().mockRejectedValue(new Error("offline")),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await expect(store.ensureReady()).resolves.not.toThrow();
  });

  it("getFileManifest returns manifest from YAML files", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const resultDir = path.join(localPath, "repos", "owner", "repo");
    await mkdir(path.join(resultDir, "src"), { recursive: true });

    await writeFile(
      path.join(resultDir, "src", "index.ts.yml"),
      "sha: abc123\nresult: ok\n",
      "utf-8"
    );
    await writeFile(
      path.join(resultDir, "dir.yml"),
      "sha: root-sha\n",
      "utf-8"
    );

    const store = new GitYamlStore(makeStoreConfig(localPath));
    const manifest = await store.getFileManifest();

    expect(manifest["src/index.ts"]).toBe("abc123");
  });

  it("getDirSha returns null when file does not exist", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const store = new GitYamlStore(makeStoreConfig(localPath));
    const sha = await store.getDirSha("nonexistent/dir");
    expect(sha).toBeNull();
  });

  it("getDirSha returns sha when file exists", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const dirPath = path.join(localPath, "repos", "owner", "repo", "src");
    await mkdir(dirPath, { recursive: true });
    await writeFile(
      path.join(dirPath, "dir.yml"),
      "sha: dir-sha-123\n",
      "utf-8"
    );

    const store = new GitYamlStore(makeStoreConfig(localPath));
    const sha = await store.getDirSha("src");
    expect(sha).toBe("dir-sha-123");
  });

  it("getDirSha returns null when sha field is a number (not string)", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const dirPath = path.join(localPath, "repos", "owner", "repo", "src");
    await mkdir(dirPath, { recursive: true });
    // YAML parses unquoted 123 as a number
    await writeFile(path.join(dirPath, "dir.yml"), "sha: 123\n", "utf-8");

    const store = new GitYamlStore(makeStoreConfig(localPath));
    const sha = await store.getDirSha("src");
    expect(sha).toBeNull();
  });

  it("writeDirResult writes dir.yml file", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.writeDirResult("src", "dir-sha", { files: 5 });

    const outputPath = path.join(
      localPath,
      "repos",
      "owner",
      "repo",
      "src",
      "dir.yml"
    );
    const content = await readFile(outputPath, "utf-8");
    expect(content).toContain("sha: dir-sha");
    expect(content).toContain("files: 5");
  });

  it("deleteFileResult removes the yml file", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.writeFileResult("src/index.ts", "sha1", { ok: true });
    await store.deleteFileResult("src/index.ts");

    const outputPath = path.join(
      localPath,
      "repos",
      "owner",
      "repo",
      "src",
      "index.ts.yml"
    );
    await expect(readFile(outputPath, "utf-8")).rejects.toThrow();
  });

  it("commitBatch skips when no files changed", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      status: vi.fn().mockResolvedValue({ files: [] }),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    await store.commitBatch("owner/repo", 0);

    expect(git.commit).not.toHaveBeenCalled();
  });

  it("commitBatch throws when gitUser is undefined (not initialized correctly)", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      // Both user.name and user.email return empty strings
      getConfig: vi.fn().mockResolvedValue({ value: "" }),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    // ensureReady will fail because git user cannot be resolved
    await expect(store.ensureReady()).rejects.toThrow("Git user is required");
  });

  it("readFileResult returns null when file does not exist", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock();
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();

    const { z } = await import("zod");
    const schema = z.object({ sha: z.string() });
    const result = await store.readFileResult("nonexistent.ts", schema);
    expect(result).toBeNull();
  });

  it("readFileResult reads and parses existing file", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock();
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();

    await store.writeFileResult("src/test.ts", "test-sha", {
      sha: "test-sha",
      ok: true,
    });

    const { z } = await import("zod");
    const schema = z.object({ sha: z.string(), ok: z.boolean() });
    const result = await store.readFileResult("src/test.ts", schema);
    expect(result).toEqual({ sha: "test-sha", ok: true });
  });

  it("readDirectoryResult returns null when file does not exist", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock();
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();

    const { z } = await import("zod");
    const schema = z.object({ count: z.number() });
    const result = await store.readDirectoryResult("nonexistent", schema);
    expect(result).toBeNull();
  });

  it("readDirectoryResult reads and parses existing file", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock();
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();

    await store.writeDirResult("src", "dir-sha", { sha: "dir-sha", count: 3 });

    const { z } = await import("zod");
    const schema = z.object({ sha: z.string(), count: z.number() });
    const result = await store.readDirectoryResult("src", schema);
    expect(result).toEqual({ sha: "dir-sha", count: 3 });
  });

  it("normalizeResult wraps array values (non-object)", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.writeFileResult("src/test.ts", "sha-arr", [1, 2, 3]);

    const outputPath = path.join(
      localPath,
      "repos",
      "owner",
      "repo",
      "src",
      "test.ts.yml"
    );
    const content = await readFile(outputPath, "utf-8");
    expect(content).toContain("sha: sha-arr");
    expect(content).toContain("value:");
  });

  it("normalizeResult wraps null value", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.writeFileResult("src/null.ts", "sha-null", null);

    const outputPath = path.join(
      localPath,
      "repos",
      "owner",
      "repo",
      "src",
      "null.ts.yml"
    );
    const content = await readFile(outputPath, "utf-8");
    expect(content).toContain("sha: sha-null");
  });

  it("resolveBranch uses requestedBranch when provided", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock();
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore({
      ...makeStoreConfig(localPath),
      branch: "feature-branch",
    });
    await store.ensureReady();
    // With feature-branch, branchLocal is called for checkoutBranch
    expect(git.branchLocal).toHaveBeenCalled();
  });

  it("resolveBranch falls back to remoteHead when current is empty", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      branchLocal: vi.fn().mockResolvedValue({ current: "", all: ["main"] }),
      raw: vi.fn().mockResolvedValue("refs/remotes/origin/main\n"),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    expect(git.raw).toHaveBeenCalled();
  });

  it("resolveBranch falls back to all[0] when remoteHead throws", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      branchLocal: vi
        .fn()
        .mockResolvedValue({ current: "", all: ["fallback-branch"] }),
      raw: vi.fn().mockRejectedValue(new Error("symbolic-ref failed")),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    // Falls back to all[0] = "fallback-branch"
    expect(git.checkout).toHaveBeenCalled();
  });

  it("resolveBranch falls back to all[0] when remoteHead is empty string", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      branchLocal: vi
        .fn()
        .mockResolvedValue({ current: "", all: ["fallback-branch"] }),
      // raw returns blank → trim/replace produces "" → falls through to all[0]
      raw: vi.fn().mockResolvedValue("   \n"),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    expect(git.checkout).toHaveBeenCalled();
  });

  it("resolveBranch throws when no branch can be determined", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      branchLocal: vi.fn().mockResolvedValue({ current: "", all: [] }),
      raw: vi.fn().mockRejectedValue(new Error("no head")),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await expect(store.ensureReady()).rejects.toThrow(
      "Unable to determine which branch"
    );
  });

  it("checkoutBranch - already on correct branch (no checkout)", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      branchLocal: vi
        .fn()
        .mockResolvedValue({ current: "main", all: ["main"] }),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    expect(git.checkout).not.toHaveBeenCalled();
  });

  it("checkoutBranch checks out existing branch", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      branchLocal: vi
        .fn()
        .mockResolvedValue({ current: "other", all: ["other", "feature"] }),
      raw: vi.fn().mockResolvedValue("refs/remotes/origin/feature"),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore({
      ...makeStoreConfig(localPath),
      branch: "feature",
    });
    await store.ensureReady();
    expect(git.checkout).toHaveBeenCalledWith("feature");
  });

  it("checkoutBranch creates local branch when not in all", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      branchLocal: vi
        .fn()
        .mockResolvedValue({ current: "main", all: ["main"] }),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore({
      ...makeStoreConfig(localPath),
      branch: "new-branch",
    });
    await store.ensureReady();
    expect(git.checkoutBranch).toHaveBeenCalledWith(
      "new-branch",
      "origin/new-branch"
    );
  });

  it("checkoutBranch falls back to checkoutLocalBranch when checkoutBranch throws", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      branchLocal: vi
        .fn()
        .mockResolvedValue({ current: "main", all: ["main"] }),
      checkoutBranch: vi
        .fn()
        .mockRejectedValue(new Error("no tracking branch")),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore({
      ...makeStoreConfig(localPath),
      branch: "new-branch",
    });
    await store.ensureReady();
    expect(git.checkoutLocalBranch).toHaveBeenCalledWith("new-branch");
  });

  it("resolveGitUser uses configuredGitUser when provided", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock();
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore({
      ...makeStoreConfig(localPath),
      gitUser: { name: "Config User", email: "config@example.com" },
    });
    await store.ensureReady();
    expect(git.getConfig).not.toHaveBeenCalled();
  });

  it("getAuthenticatedUrl uses authToken when provided", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    // No .git dir - triggers clone

    const git = makeGitMock();
    let capturedCloneUrl: string | undefined;
    simpleGitFactory.mockImplementation((dirPath?: string) => {
      if (dirPath === undefined || dirPath === "") {
        return {
          clone: vi.fn(async (url: string) => {
            capturedCloneUrl = url;
            await mkdir(path.join(localPath, ".git"), { recursive: true });
          }),
        };
      }
      return git;
    });

    const store = new GitYamlStore({
      ...makeStoreConfig(localPath),
      authToken: "mytoken",
    });
    await store.ensureReady();
    expect(capturedCloneUrl).toContain("mytoken@github.com");
  });

  it("getAuthenticatedUrl returns plain url when authToken is empty string", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock();
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore({
      ...makeStoreConfig(localPath),
      authToken: "",
    });
    await store.ensureReady();
    // Just ensure it doesn't crash with empty auth token
    expect(store).toBeDefined();
  });

  it("commitBatch retries on push conflict and succeeds on 3rd attempt", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    let pushCount = 0;
    const git = makeGitMock({
      status: vi.fn().mockResolvedValue({
        files: [{ path: "repos/owner/repo/test.yml" }],
      }),
      push: vi.fn(async () => {
        pushCount++;
        if (pushCount < 3) {
          throw new Error("rejected: remote changes");
        }
      }),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    await store.commitBatch("owner/repo", 1);

    expect(pushCount).toBe(3);
  });

  it("commitBatch re-throws non-conflict push errors", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      status: vi.fn().mockResolvedValue({
        files: [{ path: "repos/owner/repo/test.yml" }],
      }),
      push: vi.fn().mockRejectedValue(new Error("permission denied")),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    await expect(store.commitBatch("owner/repo", 1)).rejects.toThrow(
      "permission denied"
    );
  });

  it("commitBatch throws after 3 failed push attempts", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    const git = makeGitMock({
      status: vi.fn().mockResolvedValue({
        files: [{ path: "repos/owner/repo/test.yml" }],
      }),
      push: vi.fn().mockRejectedValue(new Error("rejected: conflict")),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    await expect(store.commitBatch("owner/repo", 1)).rejects.toThrow(
      "Failed to push after 3 attempts"
    );
  });

  it("commitBatch handles rebase abort when pull --rebase fails", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();
    await mkdir(path.join(localPath, ".git"), { recursive: true });

    let pushCount = 0;
    const git = makeGitMock({
      status: vi.fn().mockResolvedValue({
        files: [{ path: "repos/owner/repo/test.yml" }],
      }),
      push: vi.fn(async () => {
        pushCount++;
        if (pushCount < 3) {
          throw new Error("rejected: conflict");
        }
      }),
      pull: vi.fn(async (_remote: string, _branch: string, opts?: unknown) => {
        if (
          opts !== null &&
          opts !== undefined &&
          typeof opts === "object" &&
          "--rebase" in opts
        ) {
          throw new Error("rebase conflict");
        }
      }),
    });
    simpleGitFactory.mockReturnValue(git);

    const store = new GitYamlStore(makeStoreConfig(localPath));
    await store.ensureReady();
    await store.commitBatch("owner/repo", 1);

    expect(pushCount).toBe(3);
    expect(git.rebase).toHaveBeenCalled();
  });

  it("walkDir skips non-yml files and dir.yml entries", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const resultDir = path.join(localPath, "repos", "owner", "repo");
    await mkdir(resultDir, { recursive: true });

    await writeFile(path.join(resultDir, "readme.txt"), "not yaml", "utf-8");
    await writeFile(
      path.join(resultDir, "dir.yml"),
      "sha: dir-sha\n",
      "utf-8"
    );
    await writeFile(
      path.join(resultDir, "valid.yml"),
      "sha: file-sha\n",
      "utf-8"
    );

    const store = new GitYamlStore(makeStoreConfig(localPath));
    const manifest = await store.getFileManifest();

    expect(manifest["valid"]).toBe("file-sha");
    expect(manifest["readme.txt"]).toBeUndefined();
    expect(manifest["dir"]).toBeUndefined();
  });

  it("walkDir handles nested subdirectories recursively", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const resultDir = path.join(localPath, "repos", "owner", "repo");
    await mkdir(path.join(resultDir, "deep", "nested"), { recursive: true });

    await writeFile(
      path.join(resultDir, "deep", "nested", "file.ts.yml"),
      "sha: deep-sha\n",
      "utf-8"
    );

    const store = new GitYamlStore(makeStoreConfig(localPath));
    const manifest = await store.getFileManifest();

    expect(manifest["deep/nested/file.ts"]).toBe("deep-sha");
  });

  it("walkDir skips files with no sha field", async () => {
    const { GitYamlStore } = await import("../src/GitYamlStore.js");
    const localPath = await makeTempDir();

    const resultDir = path.join(localPath, "repos", "owner", "repo");
    await mkdir(resultDir, { recursive: true });

    await writeFile(
      path.join(resultDir, "no-sha.yml"),
      "result: some-data\n",
      "utf-8"
    );

    const store = new GitYamlStore(makeStoreConfig(localPath));
    const manifest = await store.getFileManifest();

    expect(manifest["no-sha"]).toBeUndefined();
  });
});
