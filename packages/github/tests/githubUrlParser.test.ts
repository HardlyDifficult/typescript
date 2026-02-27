import { describe, it, expect } from "vitest";
import {
  parseGitHubFileUrl,
  parseGitHubDirectoryUrl,
  parseGitHubRepoReference,
} from "../src/githubUrlParser.js";

describe("parseGitHubFileUrl", () => {
  it("parses a valid GitHub file URL", () => {
    const result = parseGitHubFileUrl(
      "https://github.com/owner/repo/blob/main/src/index.ts"
    );
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "main",
      filePath: "src/index.ts",
    });
  });

  it("parses a file URL with a branch containing slashes", () => {
    const result = parseGitHubFileUrl(
      "https://github.com/owner/repo/blob/feature/my-branch/path/to/file.ts"
    );
    expect(result).not.toBeNull();
    expect(result!.owner).toBe("owner");
    expect(result!.repo).toBe("repo");
  });

  it("returns null for a directory URL", () => {
    const result = parseGitHubFileUrl(
      "https://github.com/owner/repo/tree/main/src"
    );
    expect(result).toBeNull();
  });

  it("returns null for an invalid URL", () => {
    expect(parseGitHubFileUrl("https://example.com/not/github")).toBeNull();
    expect(parseGitHubFileUrl("")).toBeNull();
  });
});

describe("parseGitHubDirectoryUrl", () => {
  it("parses a valid GitHub directory URL", () => {
    const result = parseGitHubDirectoryUrl(
      "https://github.com/owner/repo/tree/main/src/components"
    );
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "main",
      dirPath: "src/components",
    });
  });

  it("returns null for a file (blob) URL", () => {
    const result = parseGitHubDirectoryUrl(
      "https://github.com/owner/repo/blob/main/src/index.ts"
    );
    expect(result).toBeNull();
  });

  it("returns null for an invalid URL", () => {
    expect(parseGitHubDirectoryUrl("not-a-url")).toBeNull();
  });
});

describe("parseGitHubRepoReference", () => {
  it("parses owner/repo", () => {
    expect(parseGitHubRepoReference("owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses github URLs and strips .git", () => {
    expect(
      parseGitHubRepoReference("https://github.com/owner/repo.git")
    ).toEqual({
      owner: "owner",
      repo: "repo",
    });
    expect(parseGitHubRepoReference("github.com/owner/repo/pull/123")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("returns null for unsupported values", () => {
    expect(
      parseGitHubRepoReference("https://example.com/owner/repo")
    ).toBeNull();
    expect(parseGitHubRepoReference("owner")).toBeNull();
    expect(parseGitHubRepoReference("   ")).toBeNull();
  });
});
