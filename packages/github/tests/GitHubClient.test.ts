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

// Create mock instance
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
});

const mockOctokit = createMockOctokit();

// Mock Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: class {
    constructor() {
      return mockOctokit;
    }
  },
}));

describe("GitHubClient", () => {
  let client: GitHubClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockOctokit.users.getAuthenticated.mockResolvedValue({
      data: { login: "testuser" },
    });
    client = await GitHubClient.create("test-token");
  });

  describe("create", () => {
    it("resolves username from token", async () => {
      expect(mockOctokit.users.getAuthenticated).toHaveBeenCalled();
    });

    it("reads GH_PAT from environment when no token provided", async () => {
      process.env.GH_PAT = "env-token";
      try {
        await GitHubClient.create();
        expect(mockOctokit.users.getAuthenticated).toHaveBeenCalled();
      } finally {
        delete process.env.GH_PAT;
      }
    });

    it("throws when no token and no GH_PAT", async () => {
      delete process.env.GH_PAT;
      await expect(GitHubClient.create()).rejects.toThrow(
        "GitHub token is required"
      );
    });
  });

  describe("repo", () => {
    it("supports owner/repo shorthand", () => {
      const repoClient = client.repo("owner/repo");
      expect(repoClient).toBeDefined();
    });

    it("supports GitHub URL repo references", () => {
      const repoClient = client.repo("https://github.com/owner/repo/pull/42");
      expect(repoClient).toBeDefined();
    });

    it("throws for invalid repo references", () => {
      expect(() => client.repo("not-a-repo")).toThrow(
        "Invalid repository reference"
      );
    });
  });

  describe("repo().getOpenPRs", () => {
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

      const result = await client.repo("owner", "repo").getOpenPRs();

      expect(result).toEqual(prs);
      expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        state: "open",
        per_page: 100,
      });
    });
  });

  describe("repo().get", () => {
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

      const result = await client.repo("owner", "repo").get();

      expect(result).toEqual(repo);
    });
  });

  describe("repo().pr().get", () => {
    it("returns a single pull request", async () => {
      const pr = { id: 1, number: 42, title: "Test PR" };
      mockOctokit.pulls.get.mockResolvedValue({ data: pr });

      const result = await client.repo("owner", "repo").pr(42).get();

      expect(result).toEqual(pr);
      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
      });
    });
  });

  describe("repo().pr().getDiff", () => {
    it("returns diff string", async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: "diff --git a/file.ts b/file.ts",
      });

      const result = await client.repo("owner", "repo").pr(42).getDiff();

      expect(result).toBe("diff --git a/file.ts b/file.ts");
      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
        mediaType: { format: "diff" },
      });
    });
  });

  describe("repo().pr().getFiles", () => {
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

      const result = await client.repo("owner", "repo").pr(42).getFiles();

      expect(result).toEqual(files);
      expect(mockOctokit.pulls.listFiles).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
        per_page: 100,
      });
    });
  });

  describe("repo().pr().getCommits", () => {
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

      const result = await client.repo("owner", "repo").pr(42).getCommits();

      expect(result).toEqual(commits);
    });
  });

  describe("repo().pr().getCheckRuns", () => {
    it("fetches PR then returns check runs for head sha", async () => {
      const pr = {
        id: 1,
        number: 42,
        head: { sha: "abc123" },
      };
      mockOctokit.pulls.get.mockResolvedValue({ data: pr });

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

      const result = await client.repo("owner", "repo").pr(42).getCheckRuns();

      expect(result).toEqual(checkRuns);
      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        pull_number: 42,
      });
      expect(mockOctokit.checks.listForRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "abc123",
        per_page: 100,
      });
    });
  });

  describe("repo().pr().getComments", () => {
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

      const result = await client.repo("owner", "repo").pr(42).getComments();

      expect(result).toEqual(comments);
      expect(mockOctokit.issues.listComments).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 42,
        per_page: 100,
      });
    });
  });

  describe("repo().pr().getReviews", () => {
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

      const result = await client.repo("owner", "repo").pr(42).getReviews();

      expect(result).toEqual(reviews);
    });
  });

  describe("repo().pr().postComment", () => {
    it("creates a comment on a PR", async () => {
      mockOctokit.issues.createComment.mockResolvedValue({});

      await client.repo("owner", "repo").pr(42).postComment("Great work!");

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 42,
        body: "Great work!",
      });
    });
  });

  describe("repo().pr().merge", () => {
    it("squash merges a PR", async () => {
      mockOctokit.pulls.merge.mockResolvedValue({});

      await client.repo("owner", "repo").pr(42).merge("feat: my feature (#42)");

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

  describe("repo().getBranchSha", () => {
    it("returns SHA when branch exists", async () => {
      mockOctokit.git.getRef.mockResolvedValue({
        data: { ref: "refs/heads/main", object: { sha: "abc123" } },
      });

      const result = await client.repo("owner", "repo").getBranchSha("main");

      expect(result).toBe("abc123");
      expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "heads/main",
      });
    });

    it("returns null when branch does not exist (404)", async () => {
      const notFoundError = Object.assign(new Error("Not Found"), {
        status: 404,
      });
      mockOctokit.git.getRef.mockRejectedValue(notFoundError);

      const result = await client
        .repo("owner", "repo")
        .getBranchSha("nonexistent");

      expect(result).toBeNull();
    });

    it("rethrows non-404 errors", async () => {
      const serverError = Object.assign(new Error("Server Error"), {
        status: 500,
      });
      mockOctokit.git.getRef.mockRejectedValue(serverError);

      await expect(
        client.repo("owner", "repo").getBranchSha("main")
      ).rejects.toThrow("Server Error");
    });
  });

  describe("repo().mergeBranch", () => {
    it("returns SHA on 201 merge created", async () => {
      mockOctokit.repos.merge.mockResolvedValue({
        status: 201,
        data: { sha: "merge-sha-123" },
      });

      const result = await client
        .repo("owner", "repo")
        .mergeBranch("main", "feature");

      expect(result).toBe("merge-sha-123");
      expect(mockOctokit.repos.merge).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        base: "main",
        head: "feature",
        commit_message: "Merge feature into main",
      });
    });

    it("returns null on 204 already up-to-date", async () => {
      mockOctokit.repos.merge.mockResolvedValue({
        status: 204,
        data: {},
      });

      const result = await client
        .repo("owner", "repo")
        .mergeBranch("main", "feature");

      expect(result).toBeNull();
    });
  });

  describe("repo().createBranch", () => {
    it("calls createRef with refs/heads/ prefix", async () => {
      mockOctokit.git.createRef.mockResolvedValue({});

      await client.repo("owner", "repo").createBranch("my-branch", "sha123");

      expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "refs/heads/my-branch",
        sha: "sha123",
      });
    });
  });

  describe("repo().updateBranch", () => {
    it("calls updateRef with heads/ prefix", async () => {
      mockOctokit.git.updateRef.mockResolvedValue({});

      await client.repo("owner", "repo").updateBranch("my-branch", "newsha123");

      expect(mockOctokit.git.updateRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "heads/my-branch",
        sha: "newsha123",
      });
    });
  });

  describe("repo().createPR", () => {
    it("returns number and url", async () => {
      mockOctokit.pulls.create.mockResolvedValue({
        data: { number: 42, html_url: "https://github.com/owner/repo/pull/42" },
      });

      const result = await client.repo("owner", "repo").createPR({
        head: "feature",
        base: "main",
        title: "My PR",
        body: "PR body",
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
        title: "My PR",
        body: "PR body",
      });
    });
  });

  describe("repo().commitFiles", () => {
    const setupCommitMocks = () => {
      mockOctokit.git.createBlob.mockResolvedValue({
        data: { sha: "blob-sha-1" },
      });
      mockOctokit.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "parent-tree-sha" } },
      });
      mockOctokit.git.createTree.mockResolvedValue({
        data: { sha: "new-tree-sha" },
      });
      mockOctokit.git.createCommit.mockResolvedValue({
        data: { sha: "new-commit-sha" },
      });
    };

    it("creates new branch when branch does not exist", async () => {
      setupCommitMocks();
      const notFoundError = Object.assign(new Error("Not Found"), {
        status: 404,
      });
      mockOctokit.git.getRef.mockRejectedValue(notFoundError);
      mockOctokit.git.createRef.mockResolvedValue({});

      const result = await client.repo("owner", "repo").commitFiles({
        branch: "new-branch",
        files: [{ path: "README.md", content: "# Hello" }],
        message: "Add README",
        parentSha: "parent-sha-123",
      });

      expect(result).toEqual({
        commitSha: "new-commit-sha",
        branchCreated: true,
      });
      expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "refs/heads/new-branch",
        sha: "new-commit-sha",
      });
      expect(mockOctokit.git.updateRef).not.toHaveBeenCalled();
    });

    it("updates existing branch when branch already exists", async () => {
      setupCommitMocks();
      mockOctokit.git.getRef.mockResolvedValue({
        data: {
          ref: "refs/heads/existing-branch",
          object: { sha: "existing-sha" },
        },
      });
      mockOctokit.git.updateRef.mockResolvedValue({});

      const result = await client.repo("owner", "repo").commitFiles({
        branch: "existing-branch",
        files: [{ path: "README.md", content: "# Updated" }],
        message: "Update README",
        parentSha: "parent-sha-123",
      });

      expect(result).toEqual({
        commitSha: "new-commit-sha",
        branchCreated: false,
      });
      expect(mockOctokit.git.updateRef).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "heads/existing-branch",
        sha: "new-commit-sha",
      });
      expect(mockOctokit.git.createRef).not.toHaveBeenCalled();
    });

    it("sends author when provided", async () => {
      setupCommitMocks();
      const notFoundError = Object.assign(new Error("Not Found"), {
        status: 404,
      });
      mockOctokit.git.getRef.mockRejectedValue(notFoundError);
      mockOctokit.git.createRef.mockResolvedValue({});

      await client.repo("owner", "repo").commitFiles({
        branch: "new-branch",
        files: [{ path: "file.txt", content: "content" }],
        message: "Commit with author",
        parentSha: "parent-sha",
        author: { name: "AI Bot", email: "ai@example.com" },
      });

      expect(mockOctokit.git.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          author: { name: "AI Bot", email: "ai@example.com" },
        })
      );
    });

    it("omits author field when not provided", async () => {
      setupCommitMocks();
      const notFoundError = Object.assign(new Error("Not Found"), {
        status: 404,
      });
      mockOctokit.git.getRef.mockRejectedValue(notFoundError);
      mockOctokit.git.createRef.mockResolvedValue({});

      await client.repo("owner", "repo").commitFiles({
        branch: "new-branch",
        files: [{ path: "file.txt", content: "content" }],
        message: "Commit without author",
        parentSha: "parent-sha",
      });

      const callArgs = mockOctokit.git.createCommit.mock.calls[0]![0] as Record<
        string,
        unknown
      >;
      expect(callArgs).not.toHaveProperty("author");
    });

    it("creates blobs and tree correctly for multiple files", async () => {
      mockOctokit.git.createBlob
        .mockResolvedValueOnce({ data: { sha: "blob-sha-1" } })
        .mockResolvedValueOnce({ data: { sha: "blob-sha-2" } });
      mockOctokit.git.getCommit.mockResolvedValue({
        data: { tree: { sha: "parent-tree-sha" } },
      });
      mockOctokit.git.createTree.mockResolvedValue({
        data: { sha: "new-tree-sha" },
      });
      mockOctokit.git.createCommit.mockResolvedValue({
        data: { sha: "new-commit-sha" },
      });
      const notFoundError = Object.assign(new Error("Not Found"), {
        status: 404,
      });
      mockOctokit.git.getRef.mockRejectedValue(notFoundError);
      mockOctokit.git.createRef.mockResolvedValue({});

      await client.repo("owner", "repo").commitFiles({
        branch: "new-branch",
        files: [
          { path: "file1.md", content: "content1" },
          { path: "file2.md", content: "content2" },
        ],
        message: "Add files",
        parentSha: "parent-sha",
      });

      expect(mockOctokit.git.createBlob).toHaveBeenCalledTimes(2);
      expect(mockOctokit.git.createTree).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        base_tree: "parent-tree-sha",
        tree: [
          { path: "file1.md", mode: "100644", type: "blob", sha: "blob-sha-1" },
          { path: "file2.md", mode: "100644", type: "blob", sha: "blob-sha-2" },
        ],
      });
    });
  });

  describe("repo().gatherContext", () => {
    it("returns file paths and key files", async () => {
      mockOctokit.git.getTree.mockResolvedValue({
        data: {
          tree: [
            { path: "src/index.ts", type: "blob", sha: "a1" },
            { path: "src", type: "tree", sha: "a2" },
            { path: "README.md", type: "blob", sha: "a3" },
            { path: "package.json", type: "blob", sha: "a4" },
          ],
        },
      });

      const readmeContent = Buffer.from("# Hello World").toString("base64");
      const pkgContent = Buffer.from('{"name": "test"}').toString("base64");

      mockOctokit.repos.getContent
        .mockResolvedValueOnce({ data: { content: readmeContent } })
        .mockResolvedValueOnce({ data: { content: pkgContent } });

      const result = await client
        .repo("owner", "repo")
        .gatherContext(["README.md", "package.json", "MISSING.md"], 5000);

      // Filters out tree entries (only blobs)
      expect(result.filePaths).toEqual([
        "src/index.ts",
        "README.md",
        "package.json",
      ]);

      // Fetches files that exist, skips MISSING.md
      expect(result.keyFiles).toHaveLength(2);
      expect(result.keyFiles[0]).toEqual({
        path: "README.md",
        content: "# Hello World",
      });
      expect(result.keyFiles[1]).toEqual({
        path: "package.json",
        content: '{"name": "test"}',
      });
    });

    it("truncates file content to maxFileChars", async () => {
      mockOctokit.git.getTree.mockResolvedValue({
        data: {
          tree: [{ path: "README.md", type: "blob", sha: "a1" }],
        },
      });

      const longContent = Buffer.from("A".repeat(100)).toString("base64");
      mockOctokit.repos.getContent.mockResolvedValue({
        data: { content: longContent },
      });

      const result = await client
        .repo("owner", "repo")
        .gatherContext(["README.md"], 10);

      expect(result.keyFiles[0]!.content).toBe("A".repeat(10));
    });

    it("skips files that fail to fetch", async () => {
      mockOctokit.git.getTree.mockResolvedValue({
        data: {
          tree: [
            { path: "README.md", type: "blob", sha: "a1" },
            { path: "SECRET.md", type: "blob", sha: "a2" },
          ],
        },
      });

      const readmeContent = Buffer.from("# Hello").toString("base64");
      mockOctokit.repos.getContent
        .mockResolvedValueOnce({ data: { content: readmeContent } })
        .mockRejectedValueOnce(new Error("403 Forbidden"));

      const result = await client
        .repo("owner", "repo")
        .gatherContext(["README.md", "SECRET.md"], 5000);

      expect(result.keyFiles).toHaveLength(1);
      expect(result.keyFiles[0]!.path).toBe("README.md");
    });
  });
});
