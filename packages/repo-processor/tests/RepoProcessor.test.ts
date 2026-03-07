import { describe, expect, it, vi } from "vitest";
import type { TreeEntry } from "@hardlydifficult/github";
import { z } from "zod";

import { createRepoProcessorForTests } from "../src/RepoProcessor.js";
import type {
  RepoClientLike,
  ResultsStore,
} from "../src/internalTypes.js";
import type {
  RepoDirectoryInput,
  RepoFileInput,
  RepoProcessorProgress,
} from "../src/types.js";

function makeEntry(
  path: string,
  sha: string,
  type: "blob" | "tree" = "blob",
  size?: number
): TreeEntry {
  return { path, sha, type, size };
}

function makeRepoClient(
  entries: TreeEntry[],
  rootSha = "root-sha",
  fileContents: Record<string, string> = {}
): RepoClientLike & {
  getFileTree: ReturnType<typeof vi.fn>;
  getFileContent: ReturnType<typeof vi.fn>;
} {
  return {
    getFileTree: vi.fn().mockResolvedValue({ entries, rootSha }),
    getFileContent: vi.fn((filePath: string) =>
      Promise.resolve(fileContents[filePath] ?? `content of ${filePath}`)
    ),
  };
}

function makeStore(
  manifest: Record<string, string> = {},
  dirShas: Record<string, string | null> = {}
): ResultsStore & {
  ensureReady: ReturnType<typeof vi.fn>;
  getFileManifest: ReturnType<typeof vi.fn>;
  getDirSha: ReturnType<typeof vi.fn>;
  writeFileResult: ReturnType<typeof vi.fn>;
  writeDirResult: ReturnType<typeof vi.fn>;
  deleteFileResult: ReturnType<typeof vi.fn>;
  commitBatch: ReturnType<typeof vi.fn>;
  readFileResult: ReturnType<typeof vi.fn>;
  readDirectoryResult: ReturnType<typeof vi.fn>;
} {
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

function makeProcessor(config: {
  entries: TreeEntry[];
  rootSha?: string;
  fileContents?: Record<string, string>;
  manifest?: Record<string, string>;
  dirShas?: Record<string, string | null>;
  ref?: string;
  concurrency?: number;
  include?: (file: { path: string; sha: string; size?: number }) => boolean;
  processFile?: (file: RepoFileInput) => Promise<unknown>;
  processDirectory?: ((directory: RepoDirectoryInput) => Promise<unknown>) | undefined;
}) {
  const {
    entries,
    rootSha = "root-sha",
    fileContents = {},
    manifest = {},
    dirShas = {},
    ref,
    concurrency = 5,
    include = () => true,
    processFile = vi.fn().mockResolvedValue({ summary: "file" }),
  } = config;
  const repoClient = makeRepoClient(entries, rootSha, fileContents);
  const store = makeStore(manifest, dirShas);
  const processDirectory = Object.prototype.hasOwnProperty.call(
    config,
    "processDirectory"
  )
    ? config.processDirectory
    : vi.fn().mockResolvedValue({ summary: "directory" });
  const processor = createRepoProcessorForTests({
    repo: { owner: "owner", name: "repo", fullName: "owner/repo" },
    repoClient,
    store,
    ref,
    concurrency,
    include,
    processFile,
    processDirectory,
  });

  return {
    processor,
    repoClient,
    store,
    processFile,
    processDirectory,
  };
}

describe("RepoProcessor.run", () => {
  it("skips processing when files and directories are current", async () => {
    const { processor, store, processFile, processDirectory } = makeProcessor({
      entries: [
        makeEntry("src/index.ts", "sha1"),
        makeEntry("src", "src-sha", "tree"),
      ],
      manifest: { "src/index.ts": "sha1" },
      dirShas: { "": "root-sha", src: "src-sha" },
    });

    const result = await processor.run();

    expect(processFile).not.toHaveBeenCalled();
    expect(processDirectory).not.toHaveBeenCalled();
    expect(store.commitBatch).toHaveBeenCalledWith("owner/repo", 0);
    expect(result).toEqual({
      repo: "owner/repo",
      sourceSha: "root-sha",
      processedFiles: 0,
      removedFiles: 0,
      processedDirectories: 0,
    });
  });

  it("uses ref for tree and file content lookups", async () => {
    const repoClient: RepoClientLike = {
      getFileTree: vi.fn().mockResolvedValue({
        entries: [makeEntry("src/index.ts", "sha1")],
        rootSha: "root-sha",
      }),
      getFileContent: vi
        .fn()
        .mockResolvedValue("content of src/index.ts"),
    };
    const processor = createRepoProcessorForTests({
      repo: { owner: "owner", name: "repo", fullName: "owner/repo" },
      repoClient,
      store: makeStore({}, { "": "root-sha" }),
      ref: "feature/demo",
      concurrency: 5,
      include: () => true,
      processFile: vi.fn().mockResolvedValue({ ok: true }),
      processDirectory: undefined,
    });

    await processor.run();

    expect(repoClient.getFileTree).toHaveBeenCalledWith("feature/demo");
    expect(repoClient.getFileContent).toHaveBeenCalledWith(
      "src/index.ts",
      "feature/demo"
    );
  });

  it("defaults include() to all blobs", async () => {
    const processFile = vi.fn().mockResolvedValue({ ok: true });
    const { processor } = makeProcessor({
      entries: [
        makeEntry("src/index.ts", "sha1"),
        makeEntry("README.md", "sha2"),
        makeEntry("src", "src-sha", "tree"),
      ],
      processFile,
    });

    await processor.run();

    expect(processFile).toHaveBeenCalledTimes(2);
  });

  it("respects include() filters", async () => {
    const processFile = vi.fn().mockResolvedValue({ ok: true });
    const { processor } = makeProcessor({
      entries: [
        makeEntry("src/index.ts", "sha1", "blob", 10),
        makeEntry("README.md", "sha2", "blob", 20),
      ],
      include: (file) => file.path.endsWith(".ts") && file.size === 10,
      processFile,
    });

    await processor.run();

    expect(processFile).toHaveBeenCalledTimes(1);
    expect(processFile).toHaveBeenCalledWith({
      repo: "owner/repo",
      path: "src/index.ts",
      sha: "sha1",
      content: "content of src/index.ts",
    });
  });

  it("skips directory work entirely when processDirectory is omitted", async () => {
    const { processor, store } = makeProcessor({
      entries: [makeEntry("src/index.ts", "sha1")],
      processDirectory: undefined,
    });

    const result = await processor.run();

    expect(store.getDirSha).not.toHaveBeenCalled();
    expect(store.writeDirResult).not.toHaveBeenCalled();
    expect(result.processedDirectories).toBe(0);
  });

  it("commits each file batch and each directory depth group", async () => {
    const entries = [
      makeEntry("a/b/c.ts", "sha1"),
      makeEntry("a/b/d.ts", "sha2"),
      makeEntry("a/e.ts", "sha3"),
      makeEntry("a", "asha", "tree"),
      makeEntry("a/b", "absha", "tree"),
    ];
    const { processor, store } = makeProcessor({
      entries,
      concurrency: 2,
    });

    await processor.run();

    const workCommits = store.commitBatch.mock.calls.filter(
      ([, count]) => count > 0
    );
    expect(workCommits).toEqual([
      ["owner/repo", 2],
      ["owner/repo", 1],
      ["owner/repo", 1],
      ["owner/repo", 1],
      ["owner/repo", 1],
    ]);
  });

  it("removes stale files from the results store", async () => {
    const { processor, store } = makeProcessor({
      entries: [],
      manifest: { "old/file.ts": "old-sha" },
    });

    const result = await processor.run();

    expect(store.deleteFileResult).toHaveBeenCalledWith("old/file.ts");
    expect(result.removedFiles).toBe(1);
  });

  it("processes directories bottom-up", async () => {
    const processed: string[] = [];
    const processDirectory = vi.fn(async (directory: RepoDirectoryInput) => {
      processed.push(directory.path);
      return { ok: true };
    });

    const { processor } = makeProcessor({
      entries: [
        makeEntry("a/b/c/file.ts", "sha1"),
        makeEntry("a/b/file.ts", "sha2"),
        makeEntry("a", "asha", "tree"),
        makeEntry("a/b", "absha", "tree"),
        makeEntry("a/b/c", "abcsha", "tree"),
      ],
      processDirectory,
    });

    await processor.run();

    expect(processed.indexOf("a/b/c")).toBeLessThan(processed.indexOf("a/b"));
    expect(processed.indexOf("a/b")).toBeLessThan(processed.indexOf("a"));
    expect(processed.indexOf("a")).toBeLessThan(processed.indexOf(""));
  });

  it("builds flattened directory inputs", async () => {
    let captured: RepoDirectoryInput | undefined;
    const processDirectory = vi.fn(async (directory: RepoDirectoryInput) => {
      if (directory.path === "src") {
        captured = directory;
      }
      return { ok: true };
    });

    const { processor } = makeProcessor({
      entries: [
        makeEntry("src/utils/helper.ts", "sha1"),
        makeEntry("src/index.ts", "sha2"),
        makeEntry("src", "src-sha", "tree"),
        makeEntry("src/utils", "utils-sha", "tree"),
      ],
      processDirectory,
    });

    await processor.run();

    expect(captured).toEqual({
      repo: "owner/repo",
      path: "src",
      sha: "src-sha",
      files: expect.arrayContaining(["src/utils/helper.ts", "src/index.ts"]),
      children: expect.arrayContaining([
        { name: "utils", path: "src/utils", type: "directory" },
        { name: "index.ts", path: "src/index.ts", type: "file" },
      ]),
    });
  });

  it("reports progress using nested file and directory counters", async () => {
    const progress: RepoProcessorProgress[] = [];
    const { processor } = makeProcessor({
      entries: [makeEntry("index.ts", "sha1")],
    });

    await processor.run({
      onProgress(update) {
        progress.push(update);
      },
    });

    expect(progress.map((update) => update.phase)).toEqual(
      expect.arrayContaining([
        "loading",
        "files",
        "directories",
        "committing",
      ])
    );
    expect(progress.some((update) => update.files.total === 1)).toBe(true);
    expect(progress.some((update) => update.directories.total === 1)).toBe(true);
  });

  it("aggregates file failures with path details", async () => {
    const processFile = vi.fn(async (file: RepoFileInput) => {
      throw new Error(`bad ${file.path}`);
    });

    const { processor } = makeProcessor({
      entries: [makeEntry("a.ts", "sha1"), makeEntry("b.ts", "sha2")],
      concurrency: 2,
      processFile,
    });

    await expect(processor.run()).rejects.toThrow(/a\.ts: bad a\.ts/s);
    await expect(processor.run()).rejects.toThrow(/b\.ts: bad b\.ts/s);
  });

  it("aggregates directory failures with path details", async () => {
    const processDirectory = vi.fn(async (directory: RepoDirectoryInput) => {
      throw new Error(`bad ${directory.path || "root"}`);
    });

    const { processor } = makeProcessor({
      entries: [
        makeEntry("src/index.ts", "sha1"),
        makeEntry("src", "src-sha", "tree"),
      ],
      processDirectory,
    });

    await expect(processor.run()).rejects.toThrow(/src: bad src/s);
  });

  it("delegates typed result loading to the store", async () => {
    const { processor, store } = makeProcessor({
      entries: [],
      processDirectory: undefined,
    });
    const fileSchema = z.object({ sha: z.string() });
    const dirSchema = z.object({ value: z.boolean() });

    store.readFileResult.mockResolvedValue({ sha: "sha1" });
    store.readDirectoryResult.mockResolvedValue({ value: true });

    await expect(
      processor.readFileResult("src/index.ts", fileSchema)
    ).resolves.toEqual({ sha: "sha1" });
    await expect(
      processor.readDirectoryResult("src", dirSchema)
    ).resolves.toEqual({ value: true });
  });
});
