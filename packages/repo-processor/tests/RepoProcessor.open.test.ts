import { beforeEach, describe, expect, it, vi } from "vitest";

const constructorMock = vi.fn();
const repoMock = vi.fn();

vi.mock("@hardlydifficult/github", async () => {
  const actual = await vi.importActual<
    typeof import("@hardlydifficult/github")
  >("@hardlydifficult/github");

  class MockGitHubClient {
    constructor(config: unknown) {
      constructorMock(config);
    }

    repo = repoMock;
  }

  return {
    ...actual,
    GitHubClient: MockGitHubClient,
  };
});

describe("RepoProcessor.open", () => {
  beforeEach(() => {
    constructorMock.mockReset();
    repoMock.mockReset();
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

    expect(constructorMock).toHaveBeenCalledWith({ token: undefined });
    expect(repoMock).toHaveBeenCalledWith("owner/source");
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

    expect(repoMock).toHaveBeenCalledWith("hardlydifficult/typescript");
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

    expect(constructorMock).toHaveBeenCalledWith({ token: "github-token" });
  });
});
