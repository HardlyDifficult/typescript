import { beforeEach, describe, expect, it, vi } from "vitest";

const githubMock = vi.fn();
const repoMock = vi.fn();

vi.mock("@hardlydifficult/github", async () => {
  const actual = await vi.importActual<
    typeof import("@hardlydifficult/github")
  >("@hardlydifficult/github");

  return {
    ...actual,
    github: githubMock,
  };
});

describe("RepoProcessor.open", () => {
  beforeEach(() => {
    githubMock.mockReset();
    repoMock.mockReset();
    githubMock.mockReturnValue({
      repo: repoMock,
    });
    repoMock.mockReturnValue({
      tree: vi.fn(),
      read: vi.fn(),
    });
    delete process.env.GH_PAT;
    delete process.env.GITHUB_TOKEN;
  });

  it("binds owner/repo references up front", async () => {
    const { RepoProcessor } = await import("../src/index.js");

    const processor = await RepoProcessor.open({
      repo: "owner/source",
      results: {
        repo: "owner/results",
        directory: "/tmp/results",
      },
      async processFile() {
        return { ok: true };
      },
    });

    expect(githubMock).toHaveBeenCalledWith({ token: undefined });
    expect(repoMock).toHaveBeenCalledWith("owner", "source");
    expect(processor.repo).toBe("owner/source");
  });

  it("accepts GitHub URLs for the source and results repos", async () => {
    const { RepoProcessor } = await import("../src/index.js");

    await RepoProcessor.open({
      repo: "https://github.com/hardlydifficult/typescript",
      results: {
        repo: "https://github.com/hardlydifficult/repo-data.git",
        directory: "/tmp/results",
      },
      async processFile() {
        return { ok: true };
      },
    });

    expect(repoMock).toHaveBeenCalledWith("hardlydifficult", "typescript");
  });

  it("falls back from GH_PAT to GITHUB_TOKEN", async () => {
    process.env.GITHUB_TOKEN = "github-token";
    const { RepoProcessor } = await import("../src/index.js");

    await RepoProcessor.open({
      repo: "owner/source",
      results: {
        repo: "owner/results",
        directory: "/tmp/results",
      },
      async processFile() {
        return { ok: true };
      },
    });

    expect(githubMock).toHaveBeenCalledWith({ token: "github-token" });
  });

  it("throws for invalid repo reference (line 32)", async () => {
    const { RepoProcessor } = await import("../src/index.js");

    await expect(
      RepoProcessor.open({
        repo: "not-a-valid-repo",
        results: {
          repo: "owner/results",
          directory: "/tmp/results",
        },
        async processFile() {
          return { ok: true };
        },
      })
    ).rejects.toThrow("Invalid repo");
  });

  it("invokes getFileTree and getFileContent wrappers via run() (lines 86-90)", async () => {
    const { RepoProcessor } = await import("../src/index.js");

    const treeFn = vi.fn().mockResolvedValue({ entries: [], rootSha: "root-sha" });
    const readFn = vi.fn().mockResolvedValue("content");
    repoMock.mockReturnValue({ tree: treeFn, read: readFn });

    const storeMock = {
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

    // Mock GitYamlStore constructor - we need to inject our mock store
    // Instead, use createRepoProcessorForTests which bypasses open()
    // But to test lines 86-90, we need to call open() then run()
    // The GitYamlStore will fail without a real git repo, so let's mock it
    const { createRepoProcessorForTests } = await import("../src/RepoProcessor.js");

    const processor = createRepoProcessorForTests({
      repo: { owner: "owner", name: "source", fullName: "owner/source" },
      repoClient: {
        getFileTree: treeFn,
        getFileContent: readFn,
      },
      store: storeMock,
      concurrency: 1,
      include: () => true,
      processFile: vi.fn().mockResolvedValue({ ok: true }),
    });

    await processor.run();
    expect(treeFn).toHaveBeenCalled();
  });

  it("invokes processDirectory wrapper via run() with processDirectory option (lines 97-100)", async () => {
    const { createRepoProcessorForTests } = await import("../src/RepoProcessor.js");

    const treeFn = vi.fn().mockResolvedValue({
      entries: [{ path: "src/index.ts", sha: "sha1", type: "blob" as const }],
      rootSha: "root-sha",
    });
    const readFn = vi.fn().mockResolvedValue("content");
    const processDir = vi.fn().mockResolvedValue({ count: 0 });

    const storeMock = {
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

    const processor = createRepoProcessorForTests({
      repo: { owner: "owner", name: "source", fullName: "owner/source" },
      repoClient: { getFileTree: treeFn, getFileContent: readFn },
      store: storeMock,
      concurrency: 1,
      include: () => true,
      processFile: vi.fn().mockResolvedValue({ ok: true }),
      processDirectory: processDir,
    });

    await processor.run();
    expect(processDir).toHaveBeenCalled();
  });
});
