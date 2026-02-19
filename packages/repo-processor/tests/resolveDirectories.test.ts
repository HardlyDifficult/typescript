import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TreeEntry } from "@hardlydifficult/github";
import { resolveStaleDirectories } from "../src/resolveDirectories.js";
import type { ProcessorStore } from "../src/types.js";

function makeTree(
  dirs: { path: string; sha: string }[],
  blobs: { path: string; sha: string }[] = []
): TreeEntry[] {
  return [
    ...dirs.map((d) => ({ ...d, type: "tree" })),
    ...blobs.map((b) => ({ ...b, type: "blob" })),
  ];
}

function makeStore(
  dirShas: Record<string, string | null> = {}
): ProcessorStore {
  return {
    getFileManifest: vi.fn(),
    getDirSha: vi.fn(async (_owner, _repo, path) => dirShas[path] ?? null),
    writeFileResult: vi.fn(),
    writeDirResult: vi.fn(),
    deleteFileResult: vi.fn(),
    commitBatch: vi.fn(),
  };
}

describe("resolveStaleDirectories", () => {
  it("returns all dirs as stale on first run (empty store)", async () => {
    const tree = makeTree([
      { path: "", sha: "rootsha" },
      { path: "src", sha: "srcsha" },
      { path: "src/utils", sha: "utilssha" },
    ]);
    const store = makeStore({}); // all return null
    const filePaths = ["src/utils/helper.ts", "src/index.ts"];

    const result = await resolveStaleDirectories(
      "owner",
      "repo",
      [],
      filePaths,
      tree,
      store
    );

    expect(result).toContain("");
    expect(result).toContain("src");
    expect(result).toContain("src/utils");
    expect(result).toHaveLength(3);
  });

  it("detects stale dir when stored SHA differs from tree SHA", async () => {
    const tree = makeTree([
      { path: "", sha: "rootsha-new" },
      { path: "src", sha: "srcsha-new" },
    ]);
    const store = makeStore({
      "": "rootsha-old",
      src: "srcsha-old",
    });
    const filePaths = ["src/index.ts"];

    const result = await resolveStaleDirectories(
      "owner",
      "repo",
      [],
      filePaths,
      tree,
      store
    );

    expect(result).toContain("");
    expect(result).toContain("src");
  });

  it("skips dirs whose stored SHA matches current tree SHA", async () => {
    const tree = makeTree([
      { path: "", sha: "rootsha" },
      { path: "src", sha: "srcsha" },
    ]);
    const store = makeStore({
      "": "rootsha",
      src: "srcsha",
    });
    const filePaths = ["src/index.ts"];

    const result = await resolveStaleDirectories(
      "owner",
      "repo",
      [],
      filePaths,
      tree,
      store
    );

    expect(result).toHaveLength(0);
  });

  it("always includes root directory in expected dirs", async () => {
    const tree = makeTree([{ path: "", sha: "rootsha" }]);
    const store = makeStore({}); // root not stored

    const result = await resolveStaleDirectories(
      "owner",
      "repo",
      [],
      ["index.ts"],
      tree,
      store
    );

    expect(result).toContain("");
  });

  it("combines diff stale dirs with additionally discovered stale dirs", async () => {
    const tree = makeTree([
      { path: "", sha: "rootsha" },
      { path: "src", sha: "srcsha" },
      { path: "lib", sha: "libsha-new" },
    ]);
    const store = makeStore({
      "": "rootsha",
      src: "srcsha",
      lib: "libsha-old", // stale
    });
    const filePaths = ["src/index.ts", "lib/helper.ts"];

    // diff identified src as stale (file changed inside src)
    const result = await resolveStaleDirectories(
      "owner",
      "repo",
      ["src"],
      filePaths,
      tree,
      store
    );

    expect(result).toContain("src"); // from diff
    expect(result).toContain("lib"); // discovered as stale SHA
    expect(result).not.toContain(""); // root matches
  });

  it("deduplicates dirs that appear in both diff and discovery", async () => {
    const tree = makeTree([
      { path: "", sha: "rootsha" },
      { path: "src", sha: "srcsha-new" },
    ]);
    const store = makeStore({
      "": "rootsha",
      src: "srcsha-old", // stale
    });
    const filePaths = ["src/index.ts"];

    const result = await resolveStaleDirectories(
      "owner",
      "repo",
      ["src"], // src is already in diff
      filePaths,
      tree,
      store
    );

    // src should appear only once
    expect(result.filter((d) => d === "src")).toHaveLength(1);
  });

  it("handles missing dir in tree (uses empty string for SHA)", async () => {
    const tree = makeTree([{ path: "", sha: "rootsha" }]);
    // "src" has no entry in tree
    const store = makeStore({
      "": "rootsha",
      src: "some-sha", // stored sha won't match "" (empty)
    });
    const filePaths = ["src/index.ts"];

    const result = await resolveStaleDirectories(
      "owner",
      "repo",
      [],
      filePaths,
      tree,
      store
    );

    expect(result).toContain("src");
  });
});
