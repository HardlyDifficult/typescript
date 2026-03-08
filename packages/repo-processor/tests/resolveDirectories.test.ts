import { describe, expect, it, vi } from "vitest";
import type { TreeEntry } from "@hardlydifficult/github";

import { resolveStaleDirectories } from "../src/resolveDirectories.js";
import type { ResultsStore } from "../src/internalTypes.js";

function makeTree(
  dirs: { path: string; sha: string }[],
  blobs: { path: string; sha: string }[] = []
): TreeEntry[] {
  return [
    ...dirs.map((directory) => ({ ...directory, type: "tree" as const })),
    ...blobs.map((blob) => ({ ...blob, type: "blob" as const })),
  ];
}

function makeStore(dirShas: Record<string, string | null> = {}): ResultsStore {
  return {
    ensureReady: vi.fn(),
    getFileManifest: vi.fn(),
    getDirSha: vi.fn((dirPath: string) =>
      Promise.resolve(dirShas[dirPath] ?? null)
    ),
    writeFileResult: vi.fn(),
    writeDirResult: vi.fn(),
    deleteFileResult: vi.fn(),
    commitBatch: vi.fn(),
    readFileResult: vi.fn(),
    readDirectoryResult: vi.fn(),
  };
}

describe("resolveStaleDirectories", () => {
  it("returns all missing directories on first run", async () => {
    const tree = makeTree([
      { path: "", sha: "root" },
      { path: "src", sha: "src" },
      { path: "src/utils", sha: "utils" },
    ]);

    const result = await resolveStaleDirectories(
      [],
      ["src/utils/helper.ts", "src/index.ts"],
      tree,
      makeStore()
    );

    expect(result).toEqual(expect.arrayContaining(["", "src", "src/utils"]));
  });

  it("merges diff-derived and sha-derived stale directories", async () => {
    const tree = makeTree([
      { path: "", sha: "root" },
      { path: "src", sha: "src" },
      { path: "lib", sha: "lib-new" },
    ]);

    const result = await resolveStaleDirectories(
      ["src"],
      ["src/index.ts", "lib/helper.ts"],
      tree,
      makeStore({
        "": "root",
        src: "src",
        lib: "lib-old",
      })
    );

    expect(result).toContain("src");
    expect(result).toContain("lib");
    expect(result).not.toContain("");
  });
});
