import { describe, it, expect, vi, beforeEach } from "vitest";
import { BranchHeadTracker } from "../src/polling/branchHeadTracker.js";

const mockOctokit = {
  repos: {
    get: vi.fn(),
  },
  git: {
    getRef: vi.fn(),
  },
} as unknown as import("@octokit/rest").Octokit;

function stubGetRef(sha: string): void {
  (mockOctokit.git.getRef as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { object: { sha } },
  });
}

describe("BranchHeadTracker", () => {
  let tracker: BranchHeadTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new BranchHeadTracker();
  });

  it("returns no events on first check (baseline)", async () => {
    tracker.harvestDefaultBranch("owner/repo", "main");
    stubGetRef("aaa111");

    const result = await tracker.check(
      mockOctokit,
      ["owner/repo"],
      false,
      undefined
    );

    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns push event when SHA changes", async () => {
    tracker.harvestDefaultBranch("owner/repo", "main");
    stubGetRef("aaa111");

    // First check: baseline
    await tracker.check(mockOctokit, ["owner/repo"], false, undefined);

    // Second check: SHA changed
    stubGetRef("bbb222");
    const result = await tracker.check(
      mockOctokit,
      ["owner/repo"],
      true,
      undefined
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      repo: { owner: "owner", name: "repo" },
      branch: "main",
      sha: "bbb222",
      previousSha: "aaa111",
    });
    expect(result.errors).toHaveLength(0);
  });

  it("returns no events when SHA is unchanged", async () => {
    tracker.harvestDefaultBranch("owner/repo", "main");
    stubGetRef("aaa111");

    await tracker.check(mockOctokit, ["owner/repo"], false, undefined);

    const result = await tracker.check(
      mockOctokit,
      ["owner/repo"],
      true,
      undefined
    );

    expect(result.events).toHaveLength(0);
  });

  it("returns no events when initialized is false", async () => {
    tracker.harvestDefaultBranch("owner/repo", "main");
    stubGetRef("aaa111");

    await tracker.check(mockOctokit, ["owner/repo"], false, undefined);

    stubGetRef("bbb222");
    const result = await tracker.check(
      mockOctokit,
      ["owner/repo"],
      false,
      undefined
    );

    expect(result.events).toHaveLength(0);
  });

  it("uses harvested branch name (no repos.get call)", async () => {
    tracker.harvestDefaultBranch("owner/repo", "develop");
    stubGetRef("aaa111");

    await tracker.check(mockOctokit, ["owner/repo"], false, undefined);

    expect(mockOctokit.repos.get).not.toHaveBeenCalled();
    expect(mockOctokit.git.getRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/develop" })
    );
  });

  it("falls back to repos.get when no harvested branch", async () => {
    (mockOctokit.repos.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { default_branch: "trunk" },
    });
    stubGetRef("aaa111");

    await tracker.check(mockOctokit, ["owner/repo"], false, undefined);

    expect(mockOctokit.repos.get).toHaveBeenCalledOnce();
    expect(mockOctokit.git.getRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/trunk" })
    );
  });

  it("caches repos.get result across checks", async () => {
    (mockOctokit.repos.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { default_branch: "main" },
    });
    stubGetRef("aaa111");

    await tracker.check(mockOctokit, ["owner/repo"], false, undefined);
    await tracker.check(mockOctokit, ["owner/repo"], true, undefined);

    expect(mockOctokit.repos.get).toHaveBeenCalledOnce();
  });

  it("collects errors per-repo without aborting others", async () => {
    tracker.harvestDefaultBranch("owner/repo1", "main");
    tracker.harvestDefaultBranch("owner/repo2", "main");

    let callCount = 0;
    (mockOctokit.git.getRef as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("rate limited"));
        }
        return Promise.resolve({ data: { object: { sha: "aaa111" } } });
      }
    );

    const result = await tracker.check(
      mockOctokit,
      ["owner/repo1", "owner/repo2"],
      false,
      undefined
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe("rate limited");
    // Second repo still checked
    expect(callCount).toBe(2);
  });

  it("removeRepo clears cached state", async () => {
    tracker.harvestDefaultBranch("owner/repo", "main");
    stubGetRef("aaa111");

    await tracker.check(mockOctokit, ["owner/repo"], false, undefined);

    tracker.removeRepo("owner/repo");

    // After removal, needs repos.get again since harvest was cleared
    (mockOctokit.repos.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { default_branch: "main" },
    });
    stubGetRef("bbb222");

    const result = await tracker.check(
      mockOctokit,
      ["owner/repo"],
      true,
      undefined
    );

    // No event because headSha was cleared — this is a new baseline
    expect(result.events).toHaveLength(0);
    expect(mockOctokit.repos.get).toHaveBeenCalledOnce();
  });

  it("calls throttle.wait before API calls", async () => {
    tracker.harvestDefaultBranch("owner/repo", "main");
    stubGetRef("aaa111");

    const mockThrottle = { wait: vi.fn().mockResolvedValue(undefined) };

    await tracker.check(mockOctokit, ["owner/repo"], false, mockThrottle);

    expect(mockThrottle.wait).toHaveBeenCalledWith(1);
  });

  it("handles multiple repos in a single check", async () => {
    tracker.harvestDefaultBranch("owner/repo1", "main");
    tracker.harvestDefaultBranch("owner/repo2", "main");
    stubGetRef("aaa111");

    await tracker.check(
      mockOctokit,
      ["owner/repo1", "owner/repo2"],
      false,
      undefined
    );

    stubGetRef("bbb222");
    const result = await tracker.check(
      mockOctokit,
      ["owner/repo1", "owner/repo2"],
      true,
      undefined
    );

    expect(result.events).toHaveLength(2);
    const repos = result.events.map((e) => `${e.repo.owner}/${e.repo.name}`);
    expect(repos).toContain("owner/repo1");
    expect(repos).toContain("owner/repo2");
  });
});
