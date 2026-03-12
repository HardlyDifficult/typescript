import { beforeEach, describe, expect, it, vi } from "vitest";

const githubMock = vi.fn();
const repoMock = vi.fn();
const gitYamlStoreMock = vi.fn();

vi.mock("@hardlydifficult/github", async () => {
  const actual = await vi.importActual<
    typeof import("@hardlydifficult/github")
  >("@hardlydifficult/github");

  return {
    ...actual,
    github: githubMock,
  };
});

vi.mock("../src/GitYamlStore.js", () => {
  return {
    GitYamlStore: function MockGitYamlStore(this: unknown, ...args: unknown[]) {
      return gitYamlStoreMock(...args);
    },
  };
});

// Default mock store for GitYamlStore
function makeStoreMockInstance() {
  return {
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
}

describe("RepoProcessor.open", () => {
  beforeEach(() => {
    githubMock.mockReset();
    repoMock.mockReset();
    gitYamlStoreMock.mockReset();
    githubMock.mockReturnValue({
      repo: repoMock,
    });
    repoMock.mockReturnValue({
      tree: vi.fn(),
      read: vi.fn(),
    });
    gitYamlStoreMock.mockImplementation(() => makeStoreMockInstance());
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

    expect(() =>
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
    ).toThrow("Invalid repo");
  });

  it("invokes getFileTree and getFileContent wrappers via run() (lines 86-90)", async () => {
    const { RepoProcessor } = await import("../src/index.js");

    const treeFn = vi
      .fn()
      .mockResolvedValue({ entries: [], rootSha: "root-sha" });
    const readFn = vi.fn().mockResolvedValue("content");
    repoMock.mockReturnValue({ tree: treeFn, read: readFn });

    const processor = await RepoProcessor.open({
      repo: "owner/source",
      results: { repo: "owner/results", directory: "/tmp/results" },
      async processFile() {
        return { ok: true };
      },
    });

    await processor.run();
    expect(treeFn).toHaveBeenCalled();
    expect(readFn).not.toHaveBeenCalled(); // no blob entries
  });

  it("invokes processDirectory wrapper via run() with processDirectory option (lines 97-100)", async () => {
    const { RepoProcessor } = await import("../src/index.js");

    const treeFn = vi.fn().mockResolvedValue({
      entries: [{ path: "src/index.ts", sha: "sha1", type: "blob" as const }],
      rootSha: "root-sha",
    });
    const readFn = vi.fn().mockResolvedValue("content");
    const processDir = vi.fn().mockResolvedValue({ count: 0 });
    repoMock.mockReturnValue({ tree: treeFn, read: readFn });

    const storeMockInstance = makeStoreMockInstance();
    storeMockInstance.getFileManifest = vi.fn().mockResolvedValue({});
    gitYamlStoreMock.mockImplementation(() => storeMockInstance);

    const processor = await RepoProcessor.open({
      repo: "owner/source",
      results: { repo: "owner/results", directory: "/tmp/results" },
      async processFile() {
        return { ok: true };
      },
      processDirectory: processDir,
    });

    await processor.run();
    expect(processDir).toHaveBeenCalled();
  });
});
