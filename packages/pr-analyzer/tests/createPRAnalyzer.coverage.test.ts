/**
 * Additional coverage tests for createPRAnalyzer.ts
 *
 * Targeting uncovered lines:
 * - describeReference for number ref (line 247)
 * - describeReference for DiscoveredPR (lines 254-255)
 * - describeReference for PullRequest object (line 258)
 * - listMyOpenPRs throwing when myOpenPRs not implemented (line 271)
 * - mine() without configured repo (no filtering)
 * - analyzeReference with DiscoveredPR input
 * - analyzeReference with PullRequest object input
 * - classify method
 * - actionsFor method
 * - resolveConfiguredRepo throwing for invalid repo string
 * - requireConfiguredRepo throwing for no repo when analyzing number
 */

import { describe, expect, it, vi } from "vitest";
import { createPRAnalyzer } from "../src/createPRAnalyzer.js";
import type {
  CheckRun,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
  Repository,
} from "@hardlydifficult/github";
import type { DiscoveredPR, Logger, PRAnalyzerClient } from "../src/types.js";

interface Snapshot {
  readonly pr: PullRequest;
  readonly repo: Repository;
  readonly comments: readonly PullRequestComment[];
  readonly reviews: readonly PullRequestReview[];
  readonly checks: readonly CheckRun[];
  readonly timeline: readonly [];
}

function makeRepo(owner = "owner", name = "repo"): Repository {
  return {
    id: 1,
    name,
    full_name: `${owner}/${name}`,
    owner: { login: owner, id: 1 },
    html_url: `https://github.com/${owner}/${name}`,
    default_branch: "main",
    description: null,
  };
}

function makePR(
  number: number,
  overrides: Partial<PullRequest> = {},
  repo = makeRepo()
): PullRequest {
  return {
    id: number,
    number,
    title: `PR ${String(number)}`,
    body: null,
    state: "open",
    draft: false,
    user: { login: "dev", id: 10, avatar_url: "", html_url: "" },
    html_url: `${repo.html_url}/pull/${String(number)}`,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    closed_at: null,
    merged_at: null,
    head: { ref: "feature", sha: `sha-${String(number)}`, repo: null },
    base: { ref: "main", sha: "base-sha", repo },
    mergeable: true,
    mergeable_state: "mergeable",
    labels: [],
    requested_reviewers: [],
    assignees: [],
    ...overrides,
  };
}

function makePassedCheck(name = "CI"): CheckRun {
  return {
    id: 1,
    name,
    status: "completed",
    conclusion: "success",
    started_at: "2024-01-01T00:00:00Z",
    completed_at: "2024-01-01T01:00:00Z",
    html_url: "",
  };
}

function makeSnapshot(
  pr: PullRequest,
  overrides: Partial<Omit<Snapshot, "pr" | "repo">> = {}
): Snapshot {
  return {
    pr,
    repo: pr.base.repo,
    comments: overrides.comments ?? [],
    reviews: overrides.reviews ?? [],
    checks: overrides.checks ?? [],
    timeline: [],
  };
}

function makeClient(options: {
  snapshots: Record<string, Snapshot>;
  myOpenPRs?: readonly {
    readonly pr: PullRequest;
    readonly repo: { readonly owner: string; readonly name: string };
  }[];
}): {
  readonly client: PRAnalyzerClient;
  readonly prMock: ReturnType<typeof vi.fn>;
  readonly repoMock: ReturnType<typeof vi.fn>;
  readonly myOpenPRsMock: ReturnType<typeof vi.fn>;
} {
  const prMock = vi.fn((number: number, owner: string, repo: string) => {
    const ref = `${owner}/${repo}#${String(number)}`;
    const snapshot = options.snapshots[ref];
    if (snapshot === undefined) {
      throw new Error(`Missing snapshot for ${ref}`);
    }
    return {
      snapshot: vi.fn().mockResolvedValue(snapshot),
    };
  });

  const myOpenPRsMock = vi.fn().mockResolvedValue(options.myOpenPRs ?? []);

  const repoMock = vi.fn((owner: string, repo: string) => ({
    pr: (number: number) => prMock(number, owner, repo),
  }));

  return {
    client: {
      repo: repoMock,
      myOpenPRs: myOpenPRsMock,
    },
    prMock,
    repoMock,
    myOpenPRsMock,
  };
}

describe("createPRAnalyzer - additional coverage", () => {
  it("throws when analyzing a number without a configured repo", async () => {
    const { client } = makeClient({ snapshots: {} });
    const analyzer = createPRAnalyzer({ client }); // No repo configured

    await expect(analyzer.analyze(42)).rejects.toThrow(
      "A repository is required when analyzing PR numbers"
    );
  });

  it("throws for invalid repo configuration string", () => {
    const { client } = makeClient({ snapshots: {} });

    expect(() =>
      createPRAnalyzer({ client, repo: "not-a-valid-repo" })
    ).toThrow("Invalid repository reference: not-a-valid-repo");
  });

  it("analyze with a DiscoveredPR reference", async () => {
    const repo = makeRepo("owner", "repo");
    const pr = makePR(10, {}, repo);
    const { client } = makeClient({
      snapshots: {
        "owner/repo#10": makeSnapshot(pr, { checks: [makePassedCheck()] }),
      },
    });

    const analyzer = createPRAnalyzer({ client });
    const discoveredPR: DiscoveredPR = {
      pr,
      repoOwner: "owner",
      repoName: "repo",
    };

    const result = await analyzer.analyze(discoveredPR);
    expect(result.status).toBe("ready_to_merge");
  });

  it("analyze with a PullRequest object reference (not DiscoveredPR)", async () => {
    const repo = makeRepo("owner", "repo");
    const pr = makePR(11, {}, repo);
    const { client } = makeClient({
      snapshots: {
        "owner/repo#11": makeSnapshot(pr, { checks: [makePassedCheck()] }),
      },
    });

    const analyzer = createPRAnalyzer({ client });

    // Pass a PullRequest object directly (not a DiscoveredPR)
    const result = await analyzer.analyze(pr);
    expect(result.status).toBe("ready_to_merge");
    expect(result.pr.number).toBe(11);
  });

  it("analyzeMany logs error with number reference description", async () => {
    const logger: Logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const { client } = makeClient({ snapshots: {} }); // Empty snapshots → will throw
    const analyzer = createPRAnalyzer({ client, repo: "owner/repo", logger });

    // PR 99 doesn't exist in snapshots
    const results = await analyzer.analyzeMany([99]);

    expect(results).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to analyze PR",
      expect.objectContaining({
        ref: "#99", // describeReference for number
      })
    );
  });

  it("analyzeMany logs error with DiscoveredPR reference description", async () => {
    const logger: Logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const { client } = makeClient({ snapshots: {} });
    const analyzer = createPRAnalyzer({ client, logger });

    const prObj = makePR(12);
    const discoveredPR: DiscoveredPR = {
      pr: prObj,
      repoOwner: "owner",
      repoName: "repo",
    };

    // Will fail since no snapshot exists
    const results = await analyzer.analyzeMany([discoveredPR]);

    expect(results).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to analyze PR",
      expect.objectContaining({
        ref: "owner/repo#12", // describeReference for DiscoveredPR
      })
    );
  });

  it("analyzeMany logs error with PullRequest object reference description", async () => {
    const logger: Logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const { client } = makeClient({ snapshots: {} });
    const analyzer = createPRAnalyzer({ client, logger });

    const repo = makeRepo("myowner", "myrepo");
    const pr = makePR(13, {}, repo);

    // Will fail since no snapshot exists
    const results = await analyzer.analyzeMany([pr]);

    expect(results).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to analyze PR",
      expect.objectContaining({
        ref: "myowner/myrepo#13", // describeReference for PullRequest object
      })
    );
  });

  it("mine() without configured repo returns all PRs (no filtering)", async () => {
    const repo1 = makeRepo("owner1", "repo1");
    const repo2 = makeRepo("owner2", "repo2");
    const pr1 = makePR(14, {}, repo1);
    const pr2 = makePR(15, {}, repo2);

    const { client } = makeClient({
      snapshots: {
        "owner1/repo1#14": makeSnapshot(pr1, { checks: [makePassedCheck()] }),
        "owner2/repo2#15": makeSnapshot(pr2, { checks: [makePassedCheck()] }),
      },
      myOpenPRs: [
        { pr: pr1, repo: { owner: "owner1", name: "repo1" } },
        { pr: pr2, repo: { owner: "owner2", name: "repo2" } },
      ],
    });

    // No repo filter
    const analyzer = createPRAnalyzer({ client });
    const inbox = await analyzer.mine();

    expect(inbox.all).toHaveLength(2);
  });

  it("mine() throws when client does not implement myOpenPRs", async () => {
    // Client without myOpenPRs
    const clientWithoutMyPRs: PRAnalyzerClient = {
      repo: vi.fn().mockReturnValue({
        pr: vi.fn(),
      }),
      // myOpenPRs is undefined (not provided)
    };

    const analyzer = createPRAnalyzer({ client: clientWithoutMyPRs });

    await expect(analyzer.mine()).rejects.toThrow(
      "The GitHub client must implement myOpenPRs()."
    );
  });

  it("classify method (buildInbox) works with provided scanned PRs", async () => {
    const pr = makePR(16);
    const { client } = makeClient({
      snapshots: {
        "owner/repo#16": makeSnapshot(pr, { checks: [makePassedCheck()] }),
      },
    });

    const analyzer = createPRAnalyzer({ client, repo: "owner/repo" });
    const result = await analyzer.analyze(16);

    // classify is just buildInbox applied directly to ScannedPR[]
    const inbox = analyzer.classify([result]);

    expect(inbox.all).toHaveLength(1);
    expect(inbox.readyForHuman).toHaveLength(1);
  });

  it("actionsFor method returns actions for a scanned PR", async () => {
    const pr = makePR(17);
    const { client } = makeClient({
      snapshots: {
        "owner/repo#17": makeSnapshot(pr, { checks: [makePassedCheck()] }),
      },
    });

    const analyzer = createPRAnalyzer({ client, repo: "owner/repo" });
    const result = await analyzer.analyze(17);

    const actions = analyzer.actionsFor(result);
    expect(actions.map((a) => a.type)).toContain("merge");
  });

  it("analyzes a string reference that is a pure number", async () => {
    const pr = makePR(18);
    const { client } = makeClient({
      snapshots: {
        "owner/repo#18": makeSnapshot(pr, { checks: [makePassedCheck()] }),
      },
    });

    const analyzer = createPRAnalyzer({ client, repo: "owner/repo" });
    // String "18" is a pure number reference
    const result = await analyzer.analyze("18");

    expect(result.pr.number).toBe(18);
  });

  it("throws for invalid PR reference string", async () => {
    const { client } = makeClient({ snapshots: {} });
    const analyzer = createPRAnalyzer({ client, repo: "owner/repo" });

    await expect(analyzer.analyze("not-a-valid-pr-reference")).rejects.toThrow(
      "Invalid pull request reference"
    );
  });

  it("repo property is undefined when no repo configured", () => {
    const { client } = makeClient({ snapshots: {} });
    const analyzer = createPRAnalyzer({ client });
    expect(analyzer.repo).toBeUndefined();
  });

  it("repo property is set when repo is configured", () => {
    const { client } = makeClient({ snapshots: {} });
    const analyzer = createPRAnalyzer({ client, repo: "owner/repo" });
    expect(analyzer.repo).toBe("owner/repo");
  });
});
