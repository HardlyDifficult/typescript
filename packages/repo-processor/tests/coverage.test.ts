import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import from index.ts to trigger barrel execution
import {
  GitYamlStore,
  RepoProcessor,
  RepoWatcher,
} from "../src/index.js";

import { createRepoProcessorForTests } from "../src/RepoProcessor.js";
import { resolveStaleDirectories } from "../src/resolveDirectories.js";
import type { RepoClientLike, ResultsStore } from "../src/internalTypes.js";
import type { RepoFileInput, RepoDirectoryInput } from "../src/types.js";

// ========================
// index.ts exports
// ========================
describe("index.ts exports", () => {
  it("re-exports GitYamlStore, RepoProcessor, RepoWatcher", () => {
    expect(GitYamlStore).toBeDefined();
    expect(RepoProcessor).toBeDefined();
    expect(RepoWatcher).toBeDefined();
  });
});

// ========================
// Helpers
// ========================

function makeStore(
  manifest: Record<string, string> = {},
  dirShas: Record<string, string | null> = {}
): ResultsStore & Record<string, ReturnType<typeof vi.fn>> {
  return {
    ensureReady: vi.fn().mockResolvedValue(undefined),
    getFileManifest: vi.fn().mockResolvedValue(manifest),
    getDirSha: vi
      .fn()
      .mockImplementation((dirPath: string) =>
        Promise.resolve(dirShas[dirPath] ?? null)
      ),
    writeFileResult: vi.fn().mockResolvedValue(undefined),
    writeDirResult: vi.fn().mockResolvedValue(undefined),
    deleteFileResult: vi.fn().mockResolvedValue(undefined),
    commitBatch: vi.fn().mockResolvedValue(undefined),
    readFileResult: vi.fn().mockResolvedValue(null),
    readDirectoryResult: vi.fn().mockResolvedValue(null),
  };
}

// ========================
// RepoProcessor - open() method
// ========================
const githubMock = vi.fn();
const repoMock = vi.fn();

vi.mock("@hardlydifficult/github", async () => {
  const actual = await vi.importActual<typeof import("@hardlydifficult/github")>("@hardlydifficult/github");
  return { ...actual, github: githubMock };
});

describe("RepoProcessor.open additional", () => {
  beforeEach(() => {
    githubMock.mockReset();
    repoMock.mockReset();
    githubMock.mockReturnValue({ repo: repoMock });
    repoMock.mockReturnValue({
      tree: vi.fn().mockResolvedValue({ entries: [], rootSha: "root" }),
      read: vi.fn().mockResolvedValue("content"),
    });
    delete process.env.GH_PAT;
    delete process.env.GITHUB_TOKEN;
  });

  it("throws on invalid repo reference", async () => {
    await expect(
      RepoProcessor.open({
        repo: "not-valid!!!",
        results: { repo: "owner/results", directory: "/tmp/results" },
        async processFile() {
          return { ok: true };
        },
      })
    ).rejects.toThrow("Invalid repo");
  });

  it("throws on invalid results repo reference", async () => {
    await expect(
      RepoProcessor.open({
        repo: "owner/source",
        results: { repo: "not-valid!!!", directory: "/tmp/results" },
        async processFile() {
          return { ok: true };
        },
      })
    ).rejects.toThrow("Invalid results repo");
  });

  it("uses GH_PAT token when set", async () => {
    process.env.GH_PAT = "gh-pat-token";

    await RepoProcessor.open({
      repo: "owner/source",
      results: { repo: "owner/results", directory: "/tmp/results" },
      async processFile() {
        return { ok: true };
      },
    });

    expect(githubMock).toHaveBeenCalledWith({ token: "gh-pat-token" });
  });

  it("provides processDirectory wrapper when given (covers open() line 97-100)", async () => {
    const processDirectory = vi.fn().mockResolvedValue({ dirResult: true });
    const processor = await RepoProcessor.open({
      repo: "owner/source",
      results: {
        repo: "owner/results",
        directory: "/tmp/results",
        root: "custom-root",
        branch: "main",
      },
      ref: "v1.0",
      concurrency: 3,
      include: () => false,
      async processFile() {
        return { ok: true };
      },
      processDirectory,
    });

    expect(processor.repo).toBe("owner/source");
  });
});

// ========================
// RepoProcessor.run via open() - exercises getFileTree/getFileContent wrappers
// ========================
describe("RepoProcessor.run exercises getFileTree/getFileContent wrappers (lines 86-90)", () => {
  it("calls getFileTree and getFileContent via createRepoProcessorForTests", async () => {
    const treeFn = vi.fn().mockResolvedValue({
      entries: [{ path: "b.ts", sha: "sha2", type: "blob" as const }],
      rootSha: "root2",
    });
    const readFn = vi.fn().mockResolvedValue("b content");

    const processor = createRepoProcessorForTests({
      repo: { owner: "test", name: "repo2", fullName: "test/repo2" },
      repoClient: { getFileTree: treeFn, getFileContent: readFn },
      store: makeStore(),
      concurrency: 5,
      ref: "main",
      include: () => true,
      processFile: vi.fn().mockResolvedValue({ ok: true }),
      processDirectory: undefined,
    });

    await processor.run();
    expect(treeFn).toHaveBeenCalledWith("main");
    expect(readFn).toHaveBeenCalledWith("b.ts", "main");
  });
});

// ========================
// RepoWatcher additional coverage
// ========================
describe("RepoWatcher additional coverage", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((d) => rm(d, { recursive: true, force: true }))
    );
    tempDirs.length = 0;
  });

  async function makeTempDir() {
    const d = await mkdtemp(path.join(os.tmpdir(), "rp-watcher-cov-"));
    tempDirs.push(d);
    return d;
  }

  function makeWatcherProcessor(opts: {
    shouldFail?: boolean;
    failCount?: number;
    rootShas?: string[];
  } = {}) {
    const { shouldFail = false, failCount = 1, rootShas = ["sha-1"] } = opts;
    let callCount = 0;
    let failsLeft = failCount;
    const repoClient: RepoClientLike = {
      getFileTree: vi.fn(async () => {
        const sha = rootShas[Math.min(callCount, rootShas.length - 1)] ?? "sha";
        callCount++;
        if (shouldFail && failsLeft > 0) {
          failsLeft--;
          throw new Error("run failed intentionally");
        }
        return { entries: [], rootSha: sha };
      }),
      getFileContent: vi.fn(),
    };
    const store = makeStore();
    return createRepoProcessorForTests({
      repo: { owner: "test", name: "repo", fullName: "test/repo" },
      repoClient,
      store,
      concurrency: 1,
      include: () => true,
      processFile: vi.fn().mockResolvedValue({ ok: true }),
    });
  }

  it("runNow() calls onError on failure", async () => {
    const onError = vi.fn();
    const stateDir = await makeTempDir();
    const processor = makeWatcherProcessor({ shouldFail: true });
    const watcher = await processor.watch({ stateDirectory: stateDir, onError });

    await expect(watcher.runNow()).rejects.toThrow("run failed");
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("queueRun() catches errors via onError (lines 79-80)", async () => {
    const onError = vi.fn();
    const stateDir = await makeTempDir();
    const processor = makeWatcherProcessor({ shouldFail: true });
    const watcher = await processor.watch({ stateDirectory: stateDir, onError });

    watcher.handlePush("new-sha");

    // Wait for the async run to complete
    for (let i = 0; i < 20; i++) {
      if (onError.mock.calls.length > 0) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("executeWithRetry emits onEvent warning and retries (line 144-150)", async () => {
    const onEvent = vi.fn();
    const stateDir = await makeTempDir();
    // Fail once, then succeed
    const processor = makeWatcherProcessor({
      shouldFail: true,
      failCount: 1,
      rootShas: ["sha-1", "sha-2"],
    });
    const watcher = await processor.watch({
      stateDirectory: stateDir,
      maxAttempts: 2,
      onEvent,
    });

    const result = await watcher.runNow();
    expect(result.sourceSha).toBe("sha-2");
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn" })
    );
  });

  it("executeWithRetry throws lastError after max attempts (line 156)", async () => {
    const stateDir = await makeTempDir();
    // Always fail
    const processor = makeWatcherProcessor({ shouldFail: true, failCount: 99 });
    const watcher = await processor.watch({
      stateDirectory: stateDir,
      maxAttempts: 2,
    });

    await expect(watcher.runNow()).rejects.toThrow("run failed intentionally");
  });

  it("flushPendingRun with pendingSha == lastSha does not re-queue", async () => {
    const stateDir = await makeTempDir();
    const processor = makeWatcherProcessor({ rootShas: ["sha-1"] });
    const watcher = await processor.watch({ stateDirectory: stateDir });

    await watcher.runNow();
    expect(watcher.getLastSha()).toBe("sha-1");

    // handlePush with the same sha should not trigger run
    watcher.handlePush("sha-1");
    expect(watcher.isRunning()).toBe(false);
  });
});

// ========================
// resolveDirectories additional branch coverage
// ========================
describe("resolveStaleDirectories - treeShaByDir.get() ?? '' branch", () => {
  it("uses empty string when dirPath has no tree entry (line 40)", async () => {
    const store = {
      ensureReady: vi.fn(),
      getFileManifest: vi.fn(),
      getDirSha: vi.fn().mockResolvedValue("old-sha"),
      writeFileResult: vi.fn(),
      writeDirResult: vi.fn(),
      deleteFileResult: vi.fn(),
      commitBatch: vi.fn(),
      readFileResult: vi.fn(),
      readDirectoryResult: vi.fn(),
    } as ResultsStore;

    // No tree entries - treeShaByDir will be empty
    // dir "" is in allExpectedDirs, getDirSha returns "old-sha", treeShaByDir.get("") = undefined → ""
    // "old-sha" !== "" so "" gets added to needed
    const result = await resolveStaleDirectories(
      [],
      ["src/index.ts"],
      [], // empty tree - forces ?? "" branch
      store
    );

    expect(result).toContain("");
    expect(result).toContain("src");
  });
});
