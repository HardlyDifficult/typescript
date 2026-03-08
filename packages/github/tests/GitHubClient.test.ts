import { beforeEach, describe, expect, it, vi } from "vitest";

import { github, GitHubClient } from "../src/GitHubClient.js";
import { formatTimeline } from "../src/timeline.js";
import type {
  CheckRun,
  ContributionRepo,
  PullRequest,
  PullRequestComment,
  PullRequestCommit,
  PullRequestFile,
  PullRequestReview,
  Repository,
} from "../src/types.js";

const createMockOctokit = () => ({
  users: {
    getAuthenticated: vi
      .fn()
      .mockResolvedValue({ data: { login: "testuser" } }),
  },
  pulls: {
    list: vi.fn(),
    get: vi.fn(),
    listFiles: vi.fn(),
    listCommits: vi.fn(),
    listReviews: vi.fn(),
    merge: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  checks: {
    listForRef: vi.fn(),
  },
  issues: {
    listComments: vi.fn(),
    createComment: vi.fn(),
  },
  git: {
    getTree: vi.fn(),
    getRef: vi.fn(),
    createRef: vi.fn(),
    updateRef: vi.fn(),
    deleteRef: vi.fn(),
    createBlob: vi.fn(),
    createTree: vi.fn(),
    createCommit: vi.fn(),
    getCommit: vi.fn(),
  },
  repos: {
    get: vi.fn(),
    getContent: vi.fn(),
    listForOrg: vi.fn(),
    listForUser: vi.fn(),
    merge: vi.fn(),
  },
  search: {
    issuesAndPullRequests: vi.fn(),
  },
  graphql: vi.fn(),
});

const mockOctokit = createMockOctokit();
const octokitConfigs: unknown[] = [];

vi.mock("@octokit/rest", () => ({
  Octokit: class {
    constructor(config: unknown) {
      octokitConfigs.push(config);
      return mockOctokit;
    }
  },
}));

function makeRepository(overrides: Partial<Repository> = {}): Repository {
  return {
    id: 1,
    name: "repo",
    full_name: "owner/repo",
    owner: { login: "owner", id: 1 },
    html_url: "https://github.com/owner/repo",
    default_branch: "main",
    description: null,
    ...overrides,
  };
}

function makePullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 1,
    number: 42,
    title: "Test PR",
    body: "body",
    state: "open",
    draft: false,
    user: {
      login: "testuser",
      id: 1,
      avatar_url: "",
      html_url: "",
    },
    html_url: "https://github.com/owner/repo/pull/42",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    closed_at: null,
    merged_at: null,
    head: {
      ref: "feature",
      sha: "head-sha",
      repo: null,
    },
    base: {
      ref: "main",
      sha: "base-sha",
      repo: makeRepository(),
    },
    mergeable: true,
    mergeable_state: "mergeable",
    labels: [],
    requested_reviewers: [],
    assignees: [],
    ...overrides,
  };
}

function makeComment(
  overrides: Partial<PullRequestComment> = {}
): PullRequestComment {
  return {
    id: 10,
    user: {
      login: "reviewer",
      id: 2,
      avatar_url: "",
      html_url: "",
    },
    body: "Looks good",
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    html_url: "https://github.com/owner/repo/pull/42#issuecomment-10",
    ...overrides,
  };
}

function makeReview(
  overrides: Partial<PullRequestReview> = {}
): PullRequestReview {
  return {
    id: 20,
    user: {
      login: "reviewer",
      id: 2,
      avatar_url: "",
      html_url: "",
    },
    body: "Approved",
    state: "APPROVED",
    submitted_at: "2024-01-03T00:00:00Z",
    html_url: "https://github.com/owner/repo/pull/42#pullrequestreview-20",
    ...overrides,
  };
}

function makeCheckRun(overrides: Partial<CheckRun> = {}): CheckRun {
  return {
    id: 30,
    name: "CI",
    status: "completed",
    conclusion: "success",
    started_at: "2024-01-04T00:00:00Z",
    completed_at: "2024-01-04T00:01:00Z",
    html_url: "https://github.com/owner/repo/actions/runs/30",
    ...overrides,
  };
}

function makeCommit(
  overrides: Partial<PullRequestCommit> = {}
): PullRequestCommit {
  return {
    sha: "abcdef123456",
    commit: {
      author: {
        name: "Author",
        email: "author@example.com",
        date: "2024-01-05T00:00:00Z",
      },
      message: "Add feature",
    },
    author: {
      login: "author",
      id: 3,
      avatar_url: "",
      html_url: "",
    },
    html_url: "https://github.com/owner/repo/commit/abcdef1",
    ...overrides,
  };
}

describe("GitHubClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    octokitConfigs.length = 0;
    delete process.env.GH_PAT;
    delete process.env.GITHUB_TOKEN;
    mockOctokit.users.getAuthenticated.mockResolvedValue({
      data: { login: "testuser" },
    });
  });

  describe("constructor", () => {
    it("supports the github() factory", () => {
      github({ token: "test-token" });

      expect(octokitConfigs).toEqual([{ auth: "test-token" }]);
    });

    it("uses the explicit token and does not eagerly resolve the username", () => {
      new GitHubClient({ token: "test-token" });

      expect(octokitConfigs).toEqual([{ auth: "test-token" }]);
      expect(mockOctokit.users.getAuthenticated).not.toHaveBeenCalled();
    });

    it("falls back to GH_PAT before GITHUB_TOKEN", () => {
      process.env.GH_PAT = "gh-pat-token";
      process.env.GITHUB_TOKEN = "github-token";

      new GitHubClient();

      expect(octokitConfigs).toEqual([{ auth: "gh-pat-token" }]);
    });

    it("falls back to GITHUB_TOKEN when GH_PAT is missing", () => {
      process.env.GITHUB_TOKEN = "github-token";

      new GitHubClient();

      expect(octokitConfigs).toEqual([{ auth: "github-token" }]);
    });

    it("throws when no token source is available", () => {
      expect(() => new GitHubClient()).toThrow("GitHub token is required");
    });
  });

  describe("resource chaining", () => {
    it("creates repo and PR clients from explicit coordinates", async () => {
      const client = new GitHubClient({ token: "test-token" });
      const repo = makeRepository();
      const pr = makePullRequest();
      mockOctokit.repos.get.mockResolvedValue({ data: repo });
      mockOctokit.pulls.get.mockResolvedValue({ data: pr });

      await expect(client.repo("owner", "repo").get()).resolves.toEqual(repo);
      await expect(client.repo("owner", "repo").pr(42).get()).resolves.toEqual(
        pr
      );
    });
  });

  describe("repo client", () => {
    it("lists open PRs", async () => {
      const client = new GitHubClient({ token: "test-token" });
      const pr = makePullRequest();
      mockOctokit.pulls.list.mockResolvedValue({ data: [pr] });

      const result = await client.repo("owner", "repo").openPRs();

      expect(result).toEqual([pr]);
      expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        state: "open",
        per_page: 100,
      });
    });

    it("reads repository trees and file content", async () => {
      const client = new GitHubClient({ token: "test-token" });
      mockOctokit.git.getTree.mockResolvedValue({
        data: {
          tree: [{ path: "README.md", sha: "sha1", type: "blob" }],
          sha: "root-sha",
        },
      });
      mockOctokit.repos.getContent.mockResolvedValue({
        data: { content: Buffer.from("hello").toString("base64") },
      });

      await expect(client.repo("owner", "repo").tree("main")).resolves.toEqual({
        entries: [{ path: "README.md", sha: "sha1", type: "blob" }],
        rootSha: "root-sha",
      });
      await expect(
        client.repo("owner", "repo").read("README.md", "main")
      ).resolves.toBe("hello");
    });

    it("builds repo context from the configured files", async () => {
      const client = new GitHubClient({ token: "test-token" });
      mockOctokit.git.getTree.mockResolvedValue({
        data: {
          tree: [
            { path: "README.md", sha: "sha1", type: "blob" },
            { path: "package.json", sha: "sha2", type: "blob" },
          ],
          sha: "root-sha",
        },
      });
      mockOctokit.repos.getContent
        .mockResolvedValueOnce({
          data: { content: Buffer.from("README").toString("base64") },
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from("package").toString("base64") },
        });

      const result = await client.repo("owner", "repo").context({
        files: ["README.md", "package.json", "missing.md"],
        maxChars: 4,
        ref: "main",
      });

      expect(result).toEqual({
        filePaths: ["README.md", "package.json"],
        keyFiles: [
          { path: "README.md", content: "READ" },
          { path: "package.json", content: "pack" },
        ],
      });
    });

    it("resolves default branch and branch SHAs", async () => {
      const client = new GitHubClient({ token: "test-token" });
      mockOctokit.repos.get.mockResolvedValue({
        data: makeRepository({ default_branch: "trunk" }),
      });
      mockOctokit.git.getRef.mockResolvedValue({
        data: { object: { sha: "branch-sha" } },
      });

      await expect(
        client.repo("owner", "repo").defaultBranchSha()
      ).resolves.toBe("branch-sha");
      await expect(
        client.repo("owner", "repo").branchSha("feature")
      ).resolves.toBe("branch-sha");
    });

    it("returns null when a branch does not exist", async () => {
      const client = new GitHubClient({ token: "test-token" });
      mockOctokit.git.getRef.mockRejectedValue({ status: 404 });

      await expect(
        client.repo("owner", "repo").branchSha("missing")
      ).resolves.toBe(null);
    });

    it("defaults base and body when opening a pull request", async () => {
      const client = new GitHubClient({ token: "test-token" });
      mockOctokit.repos.get.mockResolvedValue({ data: makeRepository() });
      mockOctokit.pulls.create.mockResolvedValue({
        data: { number: 42, html_url: "https://github.com/owner/repo/pull/42" },
      });

      const result = await client.repo("owner", "repo").openPR({
        head: "feature",
        title: "Add feature",
      });

      expect(result).toEqual({
        number: 42,
        url: "https://github.com/owner/repo/pull/42",
      });
      expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        head: "feature",
        base: "main",
        title: "Add feature",
        body: "",
      });
    });

    it("uses the existing branch head when committing to an existing branch", async () => {
      const client = new GitHubClient({ token: "test-token" });
      mockOctokit.git.getRef.mockResolvedValue({
        data: { object: { sha: "existing-branch-sha" } },
      });
      mockOctokit.git.createBlob.mockResolvedValue({
        data: { sha: "blob-sha" },
      });
      mockOctokit.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
      });
      mockOctokit.git.createTree.mockResolvedValue({
        data: { sha: "tree-sha" },
      });
      mockOctokit.git.createCommit.mockResolvedValue({
        data: { sha: "commit-sha" },
      });

      const result = await client.repo("owner", "repo").commit({
        branch: "feature",
        files: [{ path: "README.md", content: "hello" }],
        message: "Update README",
      });

      expect(result).toEqual({
        commitSha: "commit-sha",
        branchCreated: false,
      });
      expect(mockOctokit.git.getCommit).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        commit_sha: "existing-branch-sha",
      });
      expect(mockOctokit.git.updateRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "heads/feature",
        sha: "commit-sha",
      });
    });

    it("falls back to the default branch head when creating a new branch commit", async () => {
      const client = new GitHubClient({ token: "test-token" });
      mockOctokit.git.getRef
        .mockRejectedValueOnce({ status: 404 })
        .mockResolvedValueOnce({
          data: { object: { sha: "default-branch-sha" } },
        });
      mockOctokit.repos.get.mockResolvedValue({ data: makeRepository() });
      mockOctokit.git.createBlob.mockResolvedValue({
        data: { sha: "blob-sha" },
      });
      mockOctokit.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
      });
      mockOctokit.git.createTree.mockResolvedValue({
        data: { sha: "tree-sha" },
      });
      mockOctokit.git.createCommit.mockResolvedValue({
        data: { sha: "commit-sha" },
      });

      const result = await client.repo("owner", "repo").commit({
        branch: "feature",
        files: [{ path: "README.md", content: "hello" }],
        message: "Update README",
      });

      expect(result).toEqual({
        commitSha: "commit-sha",
        branchCreated: true,
      });
      expect(mockOctokit.git.getCommit).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        commit_sha: "default-branch-sha",
      });
      expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "refs/heads/feature",
        sha: "commit-sha",
      });
    });
  });

  describe("pull request client", () => {
    it("returns PR details, files, commits, reviews, and comments", async () => {
      const client = new GitHubClient({ token: "test-token" });
      const pr = makePullRequest();
      const files: PullRequestFile[] = [
        {
          sha: "file-sha",
          filename: "src/index.ts",
          status: "modified",
          additions: 1,
          deletions: 0,
          changes: 1,
          blob_url: "",
          raw_url: "",
        },
      ];
      const commits = [makeCommit()];
      const reviews = [makeReview()];
      const comments = [makeComment()];
      mockOctokit.pulls.get.mockResolvedValue({ data: pr });
      mockOctokit.pulls.listFiles.mockResolvedValue({ data: files });
      mockOctokit.pulls.listCommits.mockResolvedValue({ data: commits });
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: reviews });
      mockOctokit.issues.listComments.mockResolvedValue({ data: comments });

      const prClient = client.repo("owner", "repo").pr(42);
      await expect(prClient.get()).resolves.toEqual(pr);
      await expect(prClient.files()).resolves.toEqual(files);
      await expect(prClient.commits()).resolves.toEqual(commits);
      await expect(prClient.reviews()).resolves.toEqual(reviews);
      await expect(prClient.comments()).resolves.toEqual(comments);
    });

    it("returns diffs and posts comments", async () => {
      const client = new GitHubClient({ token: "test-token" });
      mockOctokit.pulls.get.mockResolvedValue({ data: "diff --git a b" });

      await expect(client.repo("owner", "repo").pr(42).diff()).resolves.toBe(
        "diff --git a b"
      );

      await client.repo("owner", "repo").pr(42).comment("Great work");

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 42,
        body: "Great work",
      });
    });

    it("loads checks and builds timeline snapshots", async () => {
      const client = new GitHubClient({ token: "test-token" });
      const pr = makePullRequest();
      const comments = [makeComment()];
      const reviews = [makeReview()];
      const commits = [makeCommit()];
      const checks = [makeCheckRun()];
      mockOctokit.pulls.get.mockResolvedValue({ data: pr });
      mockOctokit.issues.listComments.mockResolvedValue({ data: comments });
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: reviews });
      mockOctokit.pulls.listCommits.mockResolvedValue({ data: commits });
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: checks },
      });

      const prClient = client.repo("owner", "repo").pr(42);
      await expect(prClient.checks()).resolves.toEqual(checks);

      const snapshot = await prClient.snapshot();
      expect(snapshot).toEqual({
        pr,
        repo: pr.base.repo,
        comments,
        reviews,
        checks,
        timeline: await prClient.timeline(),
      });
      expect(formatTimeline(snapshot.timeline)).toContain("review: approved");
      expect(mockOctokit.checks.listForRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "head-sha",
        per_page: 100,
      });
    });
  });

  describe("top-level queries", () => {
    it("lists owner repositories and falls back from org to user", async () => {
      const client = new GitHubClient({ token: "test-token" });
      const repos: ContributionRepo[] = [
        { owner: "owner", name: "repo", fullName: "owner/repo" },
      ];
      mockOctokit.repos.listForOrg
        .mockRejectedValueOnce(new Error("not an org"))
        .mockResolvedValueOnce({
          data: [{ name: "repo", full_name: "owner/repo" }],
        });
      mockOctokit.repos.listForUser.mockResolvedValue({
        data: [{ name: "repo", full_name: "owner/repo" }],
      });

      await expect(client.ownerRepositories("owner")).resolves.toEqual(repos);
      await expect(client.ownerRepositories("owner")).resolves.toEqual(repos);
    });

    it("memoizes the authenticated username for username-based queries", async () => {
      const client = new GitHubClient({ token: "test-token" });
      mockOctokit.search.issuesAndPullRequests
        .mockResolvedValueOnce({
          data: {
            items: [
              { repository_url: "https://api.github.com/repos/owner/repo" },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                repository_url: "https://api.github.com/repos/owner/repo",
                number: 42,
              },
            ],
          },
        });
      mockOctokit.pulls.get.mockResolvedValue({ data: makePullRequest() });

      await expect(client.contributedRepositories(30)).resolves.toEqual([
        { owner: "owner", name: "repo", fullName: "owner/repo" },
      ]);
      await expect(client.myOpenPRs()).resolves.toEqual([
        {
          pr: makePullRequest(),
          repo: { owner: "owner", name: "repo" },
        },
      ]);

      expect(mockOctokit.users.getAuthenticated).toHaveBeenCalledTimes(1);
    });
  });
});
