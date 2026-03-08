import { describe, expect, it } from "vitest";

import {
  assertPackageMetadata,
  assertPinnedDependencies,
  autoCommitFixes,
  ci,
  packageName,
  publishPackages,
  resolveCiBranch,
} from "../src/index.js";

describe("ci", () => {
  it("exposes an intent-first top-level API", () => {
    expect(ci.fix).toBe(autoCommitFixes);
    expect(ci.publish).toBe(publishPackages);
    expect(ci.requirePackageMetadata).toBe(assertPackageMetadata);
    expect(ci.requirePinnedDependencies).toBe(assertPinnedDependencies);
    expect(packageName).toBe("@hardlydifficult/ci-scripts");
  });
});

describe("resolveCiBranch", () => {
  it("prefers BRANCH over GitHub-provided names", () => {
    expect(
      resolveCiBranch({
        BRANCH: "explicit-branch",
        GITHUB_HEAD_REF: "pr-branch",
        GITHUB_REF_NAME: "push-branch",
      })
    ).toBe("explicit-branch");
  });

  it("falls back to GitHub branch names when BRANCH is absent", () => {
    expect(
      resolveCiBranch({
        GITHUB_HEAD_REF: "pr-branch",
      })
    ).toBe("pr-branch");
    expect(
      resolveCiBranch({
        GITHUB_REF_NAME: "push-branch",
      })
    ).toBe("push-branch");
  });
});
