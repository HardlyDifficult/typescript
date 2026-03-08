import { describe, expect, it } from "vitest";

import type { RepoProcessorOptions } from "../src/index.js";

describe("README quick start", () => {
  it("matches the intended happy-path options shape", () => {
    const options: RepoProcessorOptions<
      { path: string; sha: string; length: number },
      { path: string; fileCount: number }
    > = {
      repo: "hardlydifficult/typescript",
      ref: "main",
      results: {
        repo: "hardlydifficult/repo-data",
        directory: "./repo-data",
      },
      include(file) {
        return file.path.endsWith(".ts");
      },
      async processFile(file) {
        return {
          path: file.path,
          sha: file.sha,
          length: file.content.length,
        };
      },
      async processDirectory(directory) {
        return {
          path: directory.path,
          fileCount: directory.files.length,
        };
      },
    };

    expect(options.results.root ?? "repos").toBe("repos");
  });
});
