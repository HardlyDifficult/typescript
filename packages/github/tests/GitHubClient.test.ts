import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubClient } from "../src/GitHubClient.js";
import type {
  PullRequest,
  Repository,
  CheckRun,
  PullRequestComment,
  PullRequestReview,
  PullRequestFile,
  PullRequestCommit,
  ContributionRepo,
} from "../src/types.js";

// Mock Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

const mockOctokit = {
  pulls: {
    list: vi.fn(),
    get: vi.fn(),
    listFiles: vi.fn(),
    listCommits: vi.fn(),
    listReviews: vi.fn(),
    merge: vi.fn(),
  },
  checks: {
    listForRef: vi.fn(),
  },
  issues: {
    listComments: vi.fn(),
    createComment: vi.fn(),
  },
  repos: {
    get: vi.fn(),
    listForOrg: vi.fn(),
    listForUser: vi.fn(),
  },
  search: {
    issuesAndPullRequests: vi.fn(),
  },
};

describe("GitHubClient", () => {
  let client: GitHubClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubClient("test-token", "testuser");
  });

  describe("getOpenPRs", () => {
    it("returns open pull requests", async () => {
      const prs: PullRequest[] = [
        {
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
            sha: "abc123",
            repo: null,
          },
          base: {
            ref: "main",
            sha: "def456",
            repo: {
              id: 1,
              name: "repo",
              full_name: "owner/repo",
              owner: { login: "owner", id: 1 },
              html_url: "",
              default_branch: "main",
            },
          },
          mergeable: true,
          mergeable_state: "mergeable",
          labels: [],
          requested_reviewers: [],
          assignees: [],
        },
      ];
      mockOctokit.pulls.list.mockResolvedValue({ data: prs });

      const result = await client.getOpenPRs("owner", "repo");

      expect(result).toEqual(prs);
      expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        state: "open",
        per_page: 100,
      });
    });
  });

  describe("getPR", () => {
    it("returns a single pull request", async () => {
      const pr = { id: 1, number: 42, title: "Test PR" };
      mockOctokit.pulls.get.mockResolvedValue({ data: pr });

      const result = await client.getPR("owner", "repo", 42);

      expect(result).toEqual(pr);
      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
      });
    });
  });

  describe("getPRDiff", () => {
    it("returns diff string", async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: "diff --git a/file.ts b/file.ts",
      });

      const result = await client.getPRDiff("owner", "repo", 42);

      expect(result).toBe("diff --git a/file.ts b/file.ts");
      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
        mediaType: { format: "diff" },
      });
    });
  });

  describe("getPRFiles", () => {
    it("returns files changed in PR", async () => {
      const files: PullRequestFile[] = [
        {
          sha: "abc",
          filename: "src/index.ts",
          status: "modified",
          additions: 10,
          deletions: 5,
          changes: 15,
          blob_url: "",
          raw_url: "",
          patch: "@@ -1,5 +1,10 @@",
        },
      ];
      mockOctokit.pulls.listFiles.mockResolvedValue({ data: files });

      const result = await client.getPRFiles("owner", "repo", 42);

      expect(result).toEqual(files);
      expect(mockOctokit.pulls.listFiles).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
        per_page: 100,
      });
    });
  });

  describe("getPRCommits", () => {
    it("returns commits in PR", async () => {
      const commits: PullRequestCommit[] = [
        {
          sha: "abc123",
          commit: {
            author: {
              name: "Test",
              email: "test@example.com",
              date: "2024-01-01T00:00:00Z",
            },
            message: "fix: something",
          },
          author: { login: "testuser", id: 1, avatar_url: "", html_url: "" },
          html_url: "",
        },
      ];
      mockOctokit.pulls.listCommits.mockResolvedValue({ data: commits });

      const result = await client.getPRCommits("owner", "repo", 42);

      expect(result).toEqual(commits);
    });
  });

  describe("getCheckRuns", () => {
    it("returns check runs for a ref", async () => {
      const checkRuns: CheckRun[] = [
        {
          id: 1,
          name: "CI",
          status: "completed",
          conclusion: "success",
          started_at: "2024-01-01T00:00:00Z",
          completed_at: "2024-01-01T00:01:00Z",
          html_url: "",
        },
      ];
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { check_runs: checkRuns },
      });

      const result = await client.getCheckRuns("owner", "repo", "abc123");

      expect(result).toEqual(checkRuns);
      expect(mockOctokit.checks.listForRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "abc123",
        per_page: 100,
      });
    });
  });

  describe("getPRComments", () => {
    it("returns comments on a PR", async () => {
      const comments: PullRequestComment[] = [
        {
          id: 1,
          user: { login: "reviewer", id: 2, avatar_url: "", html_url: "" },
          body: "LGTM",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          html_url: "",
        },
      ];
      mockOctokit.issues.listComments.mockResolvedValue({ data: comments });

      const result = await client.getPRComments("owner", "repo", 42);

      expect(result).toEqual(comments);
      expect(mockOctokit.issues.listComments).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 42,
        per_page: 100,
      });
    });
  });

  describe("getPRReviews", () => {
    it("returns reviews on a PR", async () => {
      const reviews: PullRequestReview[] = [
        {
          id: 1,
          user: { login: "reviewer", id: 2, avatar_url: "", html_url: "" },
          body: "Approved",
          state: "APPROVED",
          submitted_at: "2024-01-01T00:00:00Z",
          html_url: "",
        },
      ];
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: reviews });

      const result = await client.getPRReviews("owner", "repo", 42);

      expect(result).toEqual(reviews);
    });
  });

  describe("postComment", () => {
    it("creates a comment on a PR", async () => {
      mockOctokit.issues.createComment.mockResolvedValue({});

      await client.postComment("owner", "repo", 42, "Great work!");

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 42,
        body: "Great work!",
      });
    });
  });

  describe("getRepository", () => {
    it("returns repository info", async () => {
      const repo: Repository = {
        id: 1,
        name: "repo",
        full_name: "owner/repo",
        owner: { login: "owner", id: 1 },
        html_url: "https://github.com/owner/repo",
        default_branch: "main",
      };
      mockOctokit.repos.get.mockResolvedValue({ data: repo });

      const result = await client.getRepository("owner", "repo");

      expect(result).toEqual(repo);
    });
  });

  describe("mergePR", () => {
    it("squash merges a PR", async () => {
      mockOctokit.pulls.merge.mockResolvedValue({});

      await client.mergePR("owner", "repo", 42, "feat: my feature (#42)");

      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
        merge_method: "squash",
        commit_title: "feat: my feature (#42)",
      });
    });
  });

  describe("getOwnerRepos", () => {
    it("returns repos for an organization", async () => {
      const repos = [{ name: "repo1", full_name: "org/repo1" }];
      mockOctokit.repos.listForOrg.mockResolvedValue({ data: repos });

      const result = await client.getOwnerRepos("org");

      expect(result).toEqual([
        { owner: "org", name: "repo1", fullName: "org/repo1" },
      ] satisfies ContributionRepo[]);
    });

    it("falls back to user repos if org fails", async () => {
      mockOctokit.repos.listForOrg.mockRejectedValue(new Error("Not an org"));
      const repos = [{ name: "repo1", full_name: "user/repo1" }];
      mockOctokit.repos.listForUser.mockResolvedValue({ data: repos });

      const result = await client.getOwnerRepos("user");

      expect(result).toEqual([
        { owner: "user", name: "repo1", fullName: "user/repo1" },
      ]);
    });
  });

  describe("getContributedRepos", () => {
    it("returns repos the user contributed to", async () => {
      mockOctokit.search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            { repository_url: "https://api.github.com/repos/owner/repo1" },
            { repository_url: "https://api.github.com/repos/owner/repo2" },
            { repository_url: "https://api.github.com/repos/owner/repo1" },
          ],
        },
      });

      const result = await client.getContributedRepos(30);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        owner: "owner",
        name: "repo1",
        fullName: "owner/repo1",
      });
      expect(result[1]).toEqual({
        owner: "owner",
        name: "repo2",
        fullName: "owner/repo2",
      });
    });
  });

  describe("getMyOpenPRs", () => {
    it("returns open PRs by the authenticated user", async () => {
      mockOctokit.search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            {
              number: 10,
              repository_url: "https://api.github.com/repos/owner/repo",
            },
          ],
        },
      });

      const prData = { id: 1, number: 10, title: "My PR" };
      mockOctokit.pulls.get.mockResolvedValue({ data: prData });

      const result = await client.getMyOpenPRs();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        pr: prData,
        repo: { owner: "owner", name: "repo" },
      });
      expect(mockOctokit.search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: "is:pr is:open author:testuser",
        per_page: 100,
        sort: "updated",
      });
    });
  });
});
