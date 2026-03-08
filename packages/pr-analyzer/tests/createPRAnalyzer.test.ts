import { describe, expect, it, vi } from "vitest";

import {
  createPRAnalyzer,
  DEFAULT_BOT_MENTION,
} from "../src/createPRAnalyzer.js";
import type {
  CheckRun,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
  Repository,
} from "@hardlydifficult/github";
import type { Logger, PRAnalyzerClient } from "../src/types.js";

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

function makeRunningCheck(name = "CI"): CheckRun {
  return {
    id: 2,
    name,
    status: "in_progress",
    conclusion: null,
    started_at: "2024-01-01T00:00:00Z",
    completed_at: null,
    html_url: "",
  };
}

function makeComment(
  login: string,
  body: string,
  createdAt: string
): PullRequestComment {
  return {
    id: createdAt.length,
    user: { login, id: 20, avatar_url: "", html_url: "" },
    body,
    created_at: createdAt,
    updated_at: createdAt,
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

describe("createPRAnalyzer", () => {
  it("analyzes PR numbers against the configured repo and defaults to @cursor bot mentions", async () => {
    const pr = makePR(1);
    const { client } = makeClient({
      snapshots: {
        "owner/repo#1": makeSnapshot(pr, {
          checks: [makePassedCheck()],
          comments: [
            makeComment(
              "dev",
              `${DEFAULT_BOT_MENTION} please take a look`,
              "2024-01-02T00:00:00Z"
            ),
          ],
        }),
      },
    });

    const analyzer = createPRAnalyzer({ client, repo: "owner/repo" });
    const result = await analyzer.analyze(1);

    expect(result.status).toBe("waiting_on_bot");
  });

  it("accepts PR references directly and returns precomputed actions", async () => {
    const pr = makePR(2);
    const { client } = makeClient({
      snapshots: {
        "owner/repo#2": makeSnapshot(pr, {
          checks: [makePassedCheck()],
        }),
      },
    });

    const analyzer = createPRAnalyzer({ client });
    const result = await analyzer.analyze("owner/repo#2");

    expect(result.status).toBe("ready_to_merge");
    expect(result.actions.map((action) => action.type)).toEqual(["merge"]);
  });

  it("builds inbox buckets from analyzed PRs and keeps actions attached", async () => {
    const ready = makePR(3);
    const running = makePR(4);
    const { client } = makeClient({
      snapshots: {
        "owner/repo#3": makeSnapshot(ready, {
          checks: [makePassedCheck()],
        }),
        "owner/repo#4": makeSnapshot(running, {
          checks: [makeRunningCheck()],
        }),
      },
    });

    const analyzer = createPRAnalyzer({ client, repo: "owner/repo" });
    const inbox = await analyzer.inbox([3, 4]);

    expect(inbox.readyForHuman).toHaveLength(1);
    expect(
      inbox.readyForHuman[0]?.actions.map((action) => action.type)
    ).toEqual(["merge"]);
    expect(inbox.inProgress).toHaveLength(1);
    expect(inbox.inProgress[0]?.actions.map((action) => action.type)).toEqual([
      "enable_auto_merge",
    ]);
  });

  it("filters mine() to the configured repo before analyzing", async () => {
    const workRepo = makeRepo("owner", "repo");
    const otherRepo = makeRepo("acme", "other");
    const workPR = makePR(5, {}, workRepo);
    const otherPR = makePR(6, {}, otherRepo);
    const { client, prMock, repoMock } = makeClient({
      snapshots: {
        "owner/repo#5": makeSnapshot(workPR, {
          checks: [makePassedCheck()],
        }),
        "acme/other#6": makeSnapshot(otherPR, {
          checks: [makePassedCheck()],
        }),
      },
      myOpenPRs: [
        { pr: workPR, repo: { owner: "owner", name: "repo" } },
        { pr: otherPR, repo: { owner: "acme", name: "other" } },
      ],
    });

    const analyzer = createPRAnalyzer({ client, repo: "owner/repo" });
    const inbox = await analyzer.mine();

    expect(inbox.all).toHaveLength(1);
    expect(inbox.all[0]?.pr.number).toBe(5);
    expect(repoMock).toHaveBeenCalledWith("owner", "repo");
    expect(prMock).toHaveBeenCalledTimes(1);
    expect(prMock).toHaveBeenCalledWith(5, "owner", "repo");
  });

  it("logs and skips PRs that fail during bulk analysis", async () => {
    const pr = makePR(7);
    const logger: Logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const { client } = makeClient({
      snapshots: {
        "owner/repo#7": makeSnapshot(pr, {
          checks: [makePassedCheck()],
        }),
      },
    });

    const analyzer = createPRAnalyzer({
      client,
      repo: "owner/repo",
      logger,
    });
    const results = await analyzer.analyzeMany([7, "not a pr"]);

    expect(results).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to analyze PR",
      expect.objectContaining({
        ref: "not a pr",
      })
    );
  });
});
