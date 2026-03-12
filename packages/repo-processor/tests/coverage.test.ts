import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

// Import from index.ts to trigger barrel execution
import { GitYamlStore, RepoProcessor, RepoWatcher } from "../src/index.js";

import { createRepoProcessorForTests } from "../src/RepoProcessor.js";
import { resolveStaleDirectories } from "../src/resolveDirectories.js";
import type { RepoClientLike, ResultsStore } from "../src/internalTypes.js";

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
): ResultsStore {
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
// RepoProcessor.run exercises getFileTree/getFileContent wrappers (lines 86-90)
// ========================
describe("RepoProcessor.run exercises getFileTree/getFileContent wrappers", () => {
  it("calls getFileTree and getFileContent (covers lines 86-90)", async () => {
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

  function makeWatcherProcessor(
    opts: {
      shouldFail?: boolean;
      failCount?: number;
      rootShas?: string[];
    } = {}
  ) {
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

  it("runNow() calls onError on failure (line 107)", async () => {
    const onError = vi.fn();
    const stateDir = await makeTempDir();
    const processor = makeWatcherProcessor({ shouldFail: true });
    const watcher = await processor.watch({
      stateDirectory: stateDir,
      onError,
    });

    await expect(watcher.runNow()).rejects.toThrow("run failed");
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("queueRun() catches errors via onError (lines 79-80)", async () => {
    const onError = vi.fn();
    const stateDir = await makeTempDir();
    const processor = makeWatcherProcessor({ shouldFail: true });
    const watcher = await processor.watch({
      stateDirectory: stateDir,
      onError,
    });

    watcher.handlePush("new-sha");

    // Wait for the async run to complete
    for (let i = 0; i < 30; i++) {
      if (onError.mock.calls.length > 0) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("executeWithRetry emits onEvent warning and retries (lines 144-150)", async () => {
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

  it("executeWithRetry uses String(error) when non-Error thrown (line 149)", async () => {
    const onEvent = vi.fn();
    const stateDir = await makeTempDir();
    let callCount = 0;
    const repoClient: RepoClientLike = {
      getFileTree: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "non-error string thrown"; // non-Error value
        }
        return { entries: [], rootSha: "sha-2" };
      }),
      getFileContent: vi.fn(),
    };
    const processor = createRepoProcessorForTests({
      repo: { owner: "test", name: "repo", fullName: "test/repo" },
      repoClient,
      store: makeStore(),
      concurrency: 1,
      include: () => true,
      processFile: vi.fn().mockResolvedValue({ ok: true }),
    });
    const watcher = await processor.watch({
      stateDirectory: stateDir,
      maxAttempts: 2,
      onEvent,
    });
    const result = await watcher.runNow();
    expect(result.sourceSha).toBe("sha-2");
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warn",
        context: expect.objectContaining({
          error: "non-error string thrown",
        }),
      })
    );
  });

  it("flushPendingRun with pendingSha == lastSha does not re-queue", async () => {
    const stateDir = await makeTempDir();
    const processor = makeWatcherProcessor({ rootShas: ["sha-1"] });
    const watcher = await processor.watch({ stateDirectory: stateDir });

    await watcher.runNow();
    expect(watcher.getLastSha()).toBe("sha-1");

    watcher.handlePush("sha-1");
    expect(watcher.isRunning()).toBe(false);
  });
});

// ========================
// resolveDirectories additional branch coverage
// ========================
describe("resolveStaleDirectories - treeShaByDir.get() ?? '' branch (line 40)", () => {
  it("uses empty string when dirPath has no tree entry", async () => {
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
