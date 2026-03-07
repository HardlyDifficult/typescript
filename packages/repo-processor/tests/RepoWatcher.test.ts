import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createRepoProcessorForTests } from "../src/RepoProcessor.js";
import type { RepoClientLike, ResultsStore } from "../src/internalTypes.js";

function makeProcessor(rootShaValues: string[] | (() => Promise<string>)) {
  let callCount = 0;
  const getNextSha = async () => {
    if (typeof rootShaValues === "function") {
      return rootShaValues();
    }

    const value =
      rootShaValues[Math.min(callCount, rootShaValues.length - 1)] ?? "sha";
    callCount++;
    return value;
  };

  const repoClient: RepoClientLike = {
    getFileTree: vi.fn(async () => ({
      entries: [],
      rootSha: await getNextSha(),
    })),
    getFileContent: vi.fn(),
  };
  const store: ResultsStore = {
    ensureReady: vi.fn().mockResolvedValue(undefined),
    getFileManifest: vi.fn().mockResolvedValue({}),
    getDirSha: vi.fn().mockResolvedValue(null),
    writeFileResult: vi.fn().mockResolvedValue(undefined),
    writeDirResult: vi.fn().mockResolvedValue(undefined),
    deleteFileResult: vi.fn().mockResolvedValue(undefined),
    commitBatch: vi.fn().mockResolvedValue(undefined),
    readFileResult: vi.fn().mockResolvedValue(null),
    readDirectoryResult: vi.fn().mockResolvedValue(null),
  };

  return createRepoProcessorForTests({
    repo: { owner: "owner", name: "repo", fullName: "owner/repo" },
    repoClient,
    store,
    concurrency: 1,
    include: () => true,
    async processFile() {
      return { ok: true };
    },
  });
}

describe("RepoWatcher", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((directory) =>
        rm(directory, { recursive: true, force: true })
      )
    );
    tempDirs.length = 0;
  });

  async function makeWatcher(
    processor = makeProcessor(["sha-1"]),
    options: Parameters<typeof processor.watch>[0] = {}
  ) {
    const stateDirectory = await mkdtemp(
      path.join(os.tmpdir(), "repo-processor-watcher-")
    );
    tempDirs.push(stateDirectory);
    return processor.watch({ stateDirectory, ...options });
  }

  it("deduplicates push SHAs that were already processed", async () => {
    const watcher = await makeWatcher();

    watcher.setLastSha("sha-1");
    watcher.handlePush("sha-1");

    expect(watcher.isRunning()).toBe(false);
  });

  it("stores the latest processed SHA after runNow()", async () => {
    const watcher = await makeWatcher(makeProcessor(["sha-2"]));

    const result = await watcher.runNow();

    expect(result.sourceSha).toBe("sha-2");
    expect(watcher.getLastSha()).toBe("sha-2");
  });

  it("throws when runNow() is called while already running", async () => {
    let release!: () => void;
    const waiting = new Promise<string>((resolve) => {
      release = () => resolve("sha-3");
    });
    const watcher = await makeWatcher(makeProcessor(() => waiting));

    watcher.handlePush("sha-3");

    await expect(watcher.runNow()).rejects.toThrow(/Already running/);
    release();
  });

  it("queues a rerun when a newer SHA arrives mid-run", async () => {
    let releaseFirst!: () => void;
    let runCount = 0;
    const firstRun = new Promise<string>((resolve) => {
      releaseFirst = () => resolve("sha-1");
    });

    const processor = makeProcessor(async () => {
      runCount++;
      if (runCount === 1) {
        return firstRun;
      }
      return "sha-2";
    });
    const watcher = await makeWatcher(processor);

    watcher.handlePush("sha-1");
    watcher.handlePush("sha-2");
    releaseFirst();

    for (let attempt = 0; attempt < 10; attempt++) {
      if (watcher.getLastSha() === "sha-2") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(watcher.getLastSha()).toBe("sha-2");
  });

  it("reports completed runs through onComplete", async () => {
    const onComplete = vi.fn();
    const watcher = await makeWatcher(makeProcessor(["sha-4"]), {
      onComplete,
    });

    const result = await watcher.runNow();

    expect(onComplete).toHaveBeenCalledWith(result, "sha-4");
  });
});
