import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TreeEntry, FileManifest } from "@hardlydifficult/github";
import { RepoProcessor } from "../src/RepoProcessor.js";
import type {
  ProcessorStore,
  ProcessorCallbacks,
  ProgressCallback,
} from "../src/types.js";

// --- Mock helpers ---

function makeEntry(
  path: string,
  sha: string,
  type: "blob" | "tree" = "blob"
): TreeEntry {
  return { path, sha, type };
}

function makeGitHubClient(
  entries: TreeEntry[],
  rootSha = "root-sha",
  fileContents: Record<string, string> = {}
) {
  const repoClient = {
    getFileTree: vi.fn().mockResolvedValue({ entries, rootSha }),
    getFileContent: vi.fn((path: string) =>
      Promise.resolve(fileContents[path] ?? `content of ${path}`)
    ),
  };
  return {
    repo: vi.fn().mockReturnValue(repoClient),
    _repoClient: repoClient,
  };
}

function makeStore(
  manifest: FileManifest = {},
  dirShas: Record<string, string | null> = {}
): ProcessorStore & {
  writeFileResult: ReturnType<typeof vi.fn>;
  writeDirResult: ReturnType<typeof vi.fn>;
  deleteFileResult: ReturnType<typeof vi.fn>;
  commitBatch: ReturnType<typeof vi.fn>;
  ensureReady: ReturnType<typeof vi.fn>;
} {
  return {
    ensureReady: vi.fn().mockResolvedValue(undefined),
    getFileManifest: vi.fn().mockResolvedValue(manifest),
    getDirSha: vi
      .fn()
      .mockImplementation((_o, _r, path: string) =>
        Promise.resolve(dirShas[path] ?? null)
      ),
    writeFileResult: vi.fn().mockResolvedValue(undefined),
    writeDirResult: vi.fn().mockResolvedValue(undefined),
    deleteFileResult: vi.fn().mockResolvedValue(undefined),
    commitBatch: vi.fn().mockResolvedValue(undefined),
  };
}

function makeCallbacks(): ProcessorCallbacks & {
  processFile: ReturnType<typeof vi.fn>;
  processDirectory: ReturnType<typeof vi.fn>;
} {
  return {
    shouldProcess: (entry: TreeEntry) => entry.type === "blob",
    processFile: vi.fn().mockResolvedValue({ summary: "file summary" }),
    processDirectory: vi.fn().mockResolvedValue({ summary: "dir summary" }),
  };
}

// --- Tests ---

describe("RepoProcessor", () => {
  describe("no changes", () => {
    it("skips file and dir processing when everything is up to date", async () => {
      const entries = [
        makeEntry("src/index.ts", "sha1"),
        makeEntry("src", "srcsha", "tree"),
      ];
      const github = makeGitHubClient(entries);
      const store = makeStore(
        { "src/index.ts": "sha1" }, // manifest matches
        { "": "root-sha", src: "srcsha" } // dir SHAs match
      );
      const callbacks = makeCallbacks();

      const processor = new RepoProcessor({
        githubClient: github as unknown as Parameters<
          typeof RepoProcessor.prototype.run
        >[0] extends infer _
          ? never
          : never,
        store,
        callbacks,
      } as never);

      // We need to pass a proper GitHubClient interface
      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      const result = await proc.run("owner", "repo");

      expect(callbacks.processFile).not.toHaveBeenCalled();
      expect(callbacks.processDirectory).not.toHaveBeenCalled();
      expect(result.filesProcessed).toBe(0);
      expect(result.filesRemoved).toBe(0);
      expect(result.dirsProcessed).toBe(0);
    });
  });

  describe("changed files", () => {
    it("processes changed files and writes results", async () => {
      const entries = [
        makeEntry("src/index.ts", "sha-new"),
        makeEntry("src", "srcsha", "tree"),
      ];
      const github = makeGitHubClient(entries, "root-sha", {
        "src/index.ts": "file content",
      });
      const store = makeStore(
        { "src/index.ts": "sha-old" }, // old sha → changed
        { "": "root-sha", src: "srcsha" }
      );
      const callbacks = makeCallbacks();

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      const result = await proc.run("owner", "repo");

      expect(callbacks.processFile).toHaveBeenCalledTimes(1);
      expect(callbacks.processFile).toHaveBeenCalledWith({
        entry: entries[0],
        content: "file content",
      });
      expect(store.writeFileResult).toHaveBeenCalledWith(
        "owner",
        "repo",
        "src/index.ts",
        "sha-new",
        { summary: "file summary" }
      );
      expect(store.commitBatch).toHaveBeenCalled();
      expect(result.filesProcessed).toBe(1);
    });

    it("commits after each batch of concurrency size", async () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        makeEntry(`file${String(i)}.ts`, `sha${String(i)}`)
      );
      const github = makeGitHubClient(entries, "root-sha");
      // Root dir matches so no dir processing
      const store = makeStore({}, { "": "root-sha" });
      const callbacks = makeCallbacks();

      // concurrency=2 → file batches: [0,1], [2,3], [4]
      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
        concurrency: 2,
      });

      await proc.run("owner", "repo");

      expect(callbacks.processFile).toHaveBeenCalledTimes(5);
      // 3 file batch commits + 1 dir commit (root is stale when files change)
      const commitsWithWork = store.commitBatch.mock.calls.filter(
        ([, , count]) => count > 0
      );
      expect(commitsWithWork).toHaveLength(4);
      // Verify the first 3 are file batch commits
      const batchSizes = commitsWithWork
        .slice(0, 3)
        .map(([, , count]) => count);
      expect(batchSizes).toEqual([2, 2, 1]);
    });
  });

  describe("removed files", () => {
    it("calls deleteFileResult for removed files and commits", async () => {
      const entries: TreeEntry[] = []; // no blobs
      const github = makeGitHubClient(entries);
      const store = makeStore(
        { "old/file.ts": "old-sha" }, // was in manifest, now gone
        { "": "root-sha" }
      );
      const callbacks = makeCallbacks();

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      const result = await proc.run("owner", "repo");

      expect(store.deleteFileResult).toHaveBeenCalledWith(
        "owner",
        "repo",
        "old/file.ts"
      );
      expect(result.filesRemoved).toBe(1);
    });
  });

  describe("directories", () => {
    it("processes directories bottom-up (deepest first)", async () => {
      const entries = [
        makeEntry("a/b/c/file.ts", "sha1"),
        makeEntry("a/b/file.ts", "sha2"),
        makeEntry("a", "asha", "tree"),
        makeEntry("a/b", "absha", "tree"),
        makeEntry("a/b/c", "abcsha", "tree"),
      ];
      const github = makeGitHubClient(entries, "root-sha");
      // All files are new, all dirs missing
      const store = makeStore({}, {});
      const callbacks = makeCallbacks();
      const processedDirs: string[] = [];
      callbacks.processDirectory = vi.fn(async (ctx) => {
        processedDirs.push(ctx.path);
        return { summary: "ok" };
      });

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
        concurrency: 10,
      });

      await proc.run("owner", "repo");

      // a/b/c must come before a/b, a/b must come before a, a before ""
      const abcIdx = processedDirs.indexOf("a/b/c");
      const abIdx = processedDirs.indexOf("a/b");
      const aIdx = processedDirs.indexOf("a");
      const rootIdx = processedDirs.indexOf("");

      expect(abcIdx).toBeLessThan(abIdx);
      expect(abIdx).toBeLessThan(aIdx);
      expect(aIdx).toBeLessThan(rootIdx);
    });

    it("builds correct DirectoryContext for a directory", async () => {
      const entries = [
        makeEntry("src/utils/helper.ts", "sha1"),
        makeEntry("src/index.ts", "sha2"),
        makeEntry("src", "srcsha", "tree"),
        makeEntry("src/utils", "utilssha", "tree"),
      ];
      const github = makeGitHubClient(entries, "root-sha");
      const store = makeStore({}, {});
      const callbacks = makeCallbacks();
      let capturedCtx: Parameters<typeof callbacks.processDirectory>[0] | null =
        null;
      callbacks.processDirectory = vi.fn(async (ctx) => {
        if (ctx.path === "src") {
          capturedCtx = ctx;
        }
        return {};
      });

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      await proc.run("owner", "repo");

      expect(capturedCtx).not.toBeNull();
      expect(capturedCtx!.path).toBe("src");
      expect(capturedCtx!.sha).toBe("srcsha");
      expect(capturedCtx!.subtreeFilePaths).toEqual(
        expect.arrayContaining(["src/utils/helper.ts", "src/index.ts"])
      );
      // Direct children of src: utils (dir), index.ts (file)
      const childNames = capturedCtx!.children.map((c) => c.name);
      expect(childNames).toContain("utils");
      expect(childNames).toContain("index.ts");
      const utilsChild = capturedCtx!.children.find((c) => c.name === "utils");
      expect(utilsChild?.isDir).toBe(true);
      expect(utilsChild?.fullPath).toBe("src/utils");
      const fileChild = capturedCtx!.children.find(
        (c) => c.name === "index.ts"
      );
      expect(fileChild?.isDir).toBe(false);
    });
  });

  describe("progress reporting", () => {
    it("calls onProgress with correct phases", async () => {
      const entries = [makeEntry("index.ts", "sha1")];
      const github = makeGitHubClient(entries);
      const store = makeStore({}, {}); // all stale
      const callbacks = makeCallbacks();
      const phases: string[] = [];

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      await proc.run("owner", "repo", (p) => {
        if (!phases.includes(p.phase)) {
          phases.push(p.phase);
        }
      });

      expect(phases).toContain("loading");
      expect(phases).toContain("files");
      expect(phases).toContain("directories");
      expect(phases).toContain("committing");
    });

    it("reports correct filesTotal and filesCompleted counts", async () => {
      const entries = [
        makeEntry("a.ts", "sha1"),
        makeEntry("b.ts", "sha2"),
        makeEntry("c.ts", "sha3"),
      ];
      const github = makeGitHubClient(entries);
      const store = makeStore({}, { "": "root-sha" });
      const callbacks = makeCallbacks();
      const progress: Array<{ filesTotal: number; filesCompleted: number }> =
        [];

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      await proc.run("owner", "repo", (p) => {
        if (p.phase === "files") {
          progress.push({
            filesTotal: p.filesTotal,
            filesCompleted: p.filesCompleted,
          });
        }
      });

      const finalFileProgress = progress[progress.length - 1];
      expect(finalFileProgress?.filesTotal).toBe(3);
      expect(finalFileProgress?.filesCompleted).toBe(3);
    });
  });

  describe("fail-fast on errors", () => {
    it("throws with path details when processFile rejects", async () => {
      const entries = [makeEntry("bad.ts", "sha1")];
      const github = makeGitHubClient(entries);
      const store = makeStore({}, { "": "root-sha" });
      const callbacks = makeCallbacks();
      callbacks.processFile = vi
        .fn()
        .mockRejectedValue(new Error("AI timeout"));

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      await expect(proc.run("owner", "repo")).rejects.toThrow(
        /bad\.ts.*AI timeout/s
      );
    });

    it("throws with path details when processDirectory rejects", async () => {
      const entries = [
        makeEntry("src/index.ts", "sha1"),
        makeEntry("src", "srcsha", "tree"),
      ];
      const github = makeGitHubClient(entries);
      const store = makeStore({}, {});
      const callbacks = makeCallbacks();
      callbacks.processDirectory = vi
        .fn()
        .mockRejectedValue(new Error("dir failed"));

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      await expect(proc.run("owner", "repo")).rejects.toThrow(/dir failed/);
    });
  });

  describe("ensureReady", () => {
    it("calls ensureReady when provided", async () => {
      const entries: TreeEntry[] = [];
      const github = makeGitHubClient(entries);
      const store = makeStore({}, { "": "root-sha" });
      store.ensureReady = vi.fn().mockResolvedValue(undefined);
      const callbacks = makeCallbacks();

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      await proc.run("owner", "repo");

      expect(store.ensureReady).toHaveBeenCalledWith("owner", "repo");
    });

    it("works when ensureReady is not provided", async () => {
      const entries: TreeEntry[] = [];
      const github = makeGitHubClient(entries);
      const store = makeStore({}, { "": "root-sha" });
      delete (store as Partial<typeof store>).ensureReady;
      const callbacks = makeCallbacks();

      const proc = new RepoProcessor({
        githubClient: github as never,
        store,
        callbacks,
      });

      await expect(proc.run("owner", "repo")).resolves.not.toThrow();
    });
  });
});
