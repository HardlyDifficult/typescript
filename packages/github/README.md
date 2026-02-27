# @hardlydifficult/github

Typed GitHub API client with chainable PR operations and a polling watcher for real-time activity.

## Installation

```bash
npm install @hardlydifficult/github
```

## Quick Start

```typescript
import { GitHubClient } from "@hardlydifficult/github";

const client = await GitHubClient.create("ghp_...");
const repo = client.repo("owner", "repo");
const watcher = client.watch({ repos: ["owner/repo"] });

// Listen for new PRs
watcher.onNewPR(({ pr, repo }) => {
  console.log(`New PR: ${pr.title} in ${repo.owner}/${repo.name}`);
});

// Start polling every 30 seconds
await watcher.start();
```

## GitHub API Client

The `GitHubClient` provides top-level access to repositories, PR watching, and user contribution queries.

### GitHubClient.create(token)

Creates a new client instance from a personal access token. Falls back to `GH_PAT` environment variable if no token is provided.

```typescript
import { GitHubClient } from "@hardlydifficult/github";

const client = await GitHubClient.create(); // reads from GH_PAT
const client2 = await GitHubClient.create("ghp_..."); // explicit token
```

### client.repo(owner, name) / client.repo(repoRef)

Returns a `RepoClient` for repository-specific operations.

```typescript
const repo = client.repo("owner", "repo");
const sameRepo = client.repo("hardlydifficult/typescript");
const fromUrl = client.repo("https://github.com/hardlydifficult/typescript/pull/123");
```

### client.watch(options)

Returns a `PRWatcher` instance configured with the specified options.

```typescript
const watcher = client.watch({
  // `repos` accepts either "owner/repo" or GitHub URLs.
  repos: [
    "hardlydifficult/typescript",
    "https://github.com/hardlydifficult/typescript/pull/123"
  ],
  myPRs: true,
  intervalMs: 60_000
});
```

### client.getOwnerRepos(owner)

Fetches all public repositories for an owner (user or organization).

```typescript
const repos = await client.getOwnerRepos("hardlydifficult");
// => [{ owner: "hardlydifficult", name: "typescript", fullName: "hardlydifficult/typescript" }, ...]
```

### client.getContributedRepos(days)

Returns repositories where the authenticated user made PR commits in the last N days.

```typescript
const repos = await client.getContributedRepos(30);
// => Repos where user contributed in past 30 days
```

### client.getMyOpenPRs()

Returns all open PRs authored by the authenticated user.

```typescript
const results = await client.getMyOpenPRs();
// => [{ pr: PullRequest, repo: { owner, name } }, ...]
```

## RepoClient — Repository Operations

`RepoClient` provides methods to inspect and modify a specific repository.

### repo.pr(number)

Returns a `PRClient` for interacting with a specific pull request.

```typescript
const prClient = repo.pr(42);
await prClient.markReady(); // Mark PR #42 as ready for review
```

### repo.getOpenPRs()

Fetches all open pull requests in the repository.

```typescript
const prs = await repo.getOpenPRs();
```

### repo.get()

Fetches repository metadata.

```typescript
const repoInfo = await repo.get();
// => { id, name, full_name, owner, html_url, default_branch, description, ... }
```

### repo.getFileTree(sha)

Retrieves the file tree for a given commit SHA (default: `HEAD`).

```typescript
const { entries, rootSha } = await repo.getFileTree();
// entries: [{ path: "src/index.ts", type: "blob", sha: "...", size: 1234 }, ...]
```

### repo.getFileContent(filePath, ref)

Returns the content of a file as a string.

```typescript
const content = await repo.getFileContent("README.md", "main");
```

### repo.gatherContext(filesToFetch, maxFileChars)

Fetches the file tree and specific key files for AI context gathering.

```typescript
const context = await repo.gatherContext(["src/index.ts", "tsconfig.json"], 10_000);
// => { filePaths: [...], keyFiles: [{ path, content }, ...] }
```

### repo.getDefaultBranchHeadSha()

Returns the HEAD commit SHA of the repository's default branch.

```typescript
const sha = await repo.getDefaultBranchHeadSha();
```

### repo.getBranchSha(branch)

Returns the SHA of a branch, or `null` if the branch does not exist.

```typescript
const sha = await repo.getBranchSha("feature/branch");
```

### repo.mergeBranch(base, head)

Merges one branch into another. Returns the merge commit SHA on success, or `null` if already up-to-date.

```typescript
const mergeSha = await repo.mergeBranch("main", "feature/branch");
```

### repo.createBranch(branch, sha)

Creates a new branch pointing to the given SHA.

```typescript
await repo.createBranch("feature/branch", "abc123");
```

### repo.updateBranch(branch, sha)

Updates an existing branch ref to point to a new SHA.

```typescript
await repo.updateBranch("feature/branch", "def456");
```

### repo.deleteBranch(branch)

Deletes a branch reference.

```typescript
await repo.deleteBranch("feature/branch");
```

### repo.createPR(options)

Creates a new pull request.

```typescript
const pr = await repo.createPR({
  head: "feature/branch",
  base: "main",
  title: "Add new feature",
  body: "This PR adds..."
});
// => { number: 42, url: "https://github.com/owner/repo/pull/42" }
```

### repo.commitFiles(options)

Creates a commit with file changes and updates or creates the target branch.

```typescript
const result = await repo.commitFiles({
  branch: "feature/branch",
  files: [{ path: "README.md", content: "Hello" }],
  message: "Update README",
  parentSha: "abc123",
  author: { name: "Alice", email: "alice@example.com" }
});
// => { commitSha: "def456", branchCreated: true }
```

## PRClient — Pull Request Operations

`PRClient` provides high-level methods for working with a specific pull request.

### prClient.get()

Fetches the full pull request details.

```typescript
const pr = await prClient.get();
```

### prClient.getDiff()

Fetches the PR diff in text format.

```typescript
const diff = await prClient.getDiff();
```

### prClient.getFiles()

Lists files modified in the PR.

```typescript
const files = await prClient.getFiles();
// => [{ sha, filename, status, additions, deletions, changes, ... }, ...]
```

### prClient.getCommits()

Lists commits in the PR.

```typescript
const commits = await prClient.getCommits();
```

### prClient.getReviews()

Lists review objects on the PR.

```typescript
const reviews = await prClient.getReviews();
```

### prClient.getComments()

Lists comments on the PR.

```typescript
const comments = await prClient.getComments();
```

### prClient.getCheckRuns()

Lists check runs associated with the PR's head SHA.

```typescript
const checkRuns = await prClient.getCheckRuns();
```

### prClient.postComment(body)

Adds a comment to the PR.

```typescript
await prClient.postComment(" LGTM!");
```

### prClient.getTimeline()

Fetches comments, reviews, and commits in parallel and merges them into a chronologically sorted timeline.

```typescript
const timeline = await prClient.getTimeline();
// => TimelineEntry[]
```

### prClient.formatTimeline(entries)

Formats a timeline as human-readable markdown.

```typescript
const formatted = formatTimeline(timeline);
// => "[2024-01-15 10:30] 💬 @alice (comment): Looks good\n[...]"
```

### prClient.merge(title)

Squash-merges the PR with a custom commit title.

```typescript
await prClient.merge("Merge feature/branch");
```

### prClient.markReady()

Marks the PR as ready for review (unset draft).

```typescript
await prClient.markReady();
```

### prClient.enableAutoMerge(mergeMethod)

Enables auto-merge with the specified method: `SQUASH`, `MERGE`, or `REBASE`.

```typescript
await prClient.enableAutoMerge("REBASE");
```

## PRWatcher — Real-Time Event Polling

`PRWatcher` polls GitHub at regular intervals and emits events for PR activity.

For new integrations, prefer `watcher.onEvent(...)` with a single `switch` statement. Existing `onX` methods remain fully supported for compatibility.

Migration guidance: prefer `onEvent` for new code; `onX` remains supported.

### watcher.onEvent(callback)

Fires for every watcher event as a discriminated union: `{ type, payload }`.

```typescript
watcher.onEvent((event) => {
  switch (event.type) {
    case "new_pr":
      console.log(`New PR: #${event.payload.pr.number}`);
      break;
    case "comment":
      console.log(`Comment on #${event.payload.pr.number}: ${event.payload.comment.body}`);
      break;
    case "review":
      console.log(`Review on #${event.payload.pr.number}: ${event.payload.review.state}`);
      break;
    case "check_run":
      console.log(`Check run ${event.payload.checkRun.name}: ${event.payload.checkRun.status}`);
      break;
    case "merged":
    case "closed":
      console.log(`PR #${event.payload.pr.number} is now ${event.type}`);
      break;
    case "pr_updated":
      console.log(`PR #${event.payload.pr.number} metadata changed`);
      break;
    case "status_changed":
      console.log(`PR #${event.payload.pr.number} status: ${event.payload.previousStatus} -> ${event.payload.status}`);
      break;
    case "push":
      console.log(`Push on ${event.payload.repo.owner}/${event.payload.repo.name}@${event.payload.branch}`);
      break;
    case "poll_complete":
      console.log(`Tracking ${event.payload.prs.length} PRs`);
      break;
  }
});
```

### watcher.onNewPR(callback)

Fires once when a PR is first seen.

```typescript
watcher.onNewPR(({ pr, repo }) => {
  console.log(`New PR: #${pr.number}`);
});
```

### watcher.onComment(callback)

Fires when a new comment is added to a PR.

```typescript
watcher.onComment(({ comment, pr, repo }) => {
  console.log(`New comment: ${comment.body}`);
});
```

### watcher.onReview(callback)

Fires when a new review is submitted.

```typescript
watcher.onReview(({ review, pr, repo }) => {
  console.log(`New review: ${review.state}`);
});
```

### watcher.onCheckRun(callback)

Fires when a check run’s status or conclusion changes.

```typescript
watcher.onCheckRun(({ checkRun, pr, repo }) => {
  console.log(`Check run: ${checkRun.name} -> ${checkRun.status}`);
});
```

### watcher.onMerged(callback)

Fires when a PR is merged.

```typescript
watcher.onMerged(({ pr, repo }) => {
  console.log(`PR #${pr.number} merged!`);
});
```

### watcher.onClosed(callback)

Fires when a PR is closed (without merging).

```typescript
watcher.onClosed(({ pr, repo }) => {
  console.log(`PR #${pr.number} closed`);
});
```

### watcher.onPRUpdated(callback)

Fires when draft status, mergeable state, or labels change.

```typescript
watcher.onPRUpdated(({ pr, repo, changes }) => {
  if (changes.draft) {
    console.log(`PR changed from draft ${changes.draft.from} to ${changes.draft.to}`);
  }
});
```

### watcher.onStatusChanged(callback)

Fires when a user-defined status changes (requires `classifyPR` option).

```typescript
const watcher = client.watch({
  repos: ["owner/repo"],
  classifyPR: async ({ pr }) => {
    const checks = await prClient.getCheckRuns();
    return checks.every(c => c.conclusion === "success") ? "green" : "red";
  }
});

watcher.onStatusChanged(({ pr, status, previousStatus }) => {
  console.log(`PR status changed: ${previousStatus} -> ${status}`);
});
```

### watcher.onPush(callback)

Fires when the default branch HEAD changes (push event detection).

```typescript
watcher.onPush(({ repo, branch, sha, previousSha }) => {
  console.log(`New push to ${repo.owner}/${repo.name}/${branch}`);
});
```

### watcher.start()

Starts polling and returns an array of current PR statuses.

```typescript
const currentStatuses = await watcher.start();
// => PRStatusEvent[]
```

### watcher.stop()

Stops polling.

```typescript
watcher.stop();
```

### watcher.getWatchedPRs()

Returns all currently watched PRs.

```typescript
const prs = watcher.getWatchedPRs();
```

### watcher.addRepo(repo)

Adds a repository to watch.

```typescript
watcher.addRepo("owner/new-repo");
```

### watcher.removeRepo(repo)

Removes a repository from watching.

```typescript
watcher.removeRepo("owner/outdated-repo");
```

## Advanced Features

### Custom Classification

```typescript
const watcher = client.watch({
  repos: ["owner/repo"],
  classifyPR: async ({ pr, repo }, activity) => {
    if (pr.draft) return "draft";
    if (activity.comments.length > 5) return "needs_review";
    if (activity.checkRuns.some(r => r.status === "pending")) return "ci_running";
    return "approved";
  },
});

watcher.onStatusChanged(({ previousStatus, status, pr }) => {
  console.log(`Status changed for #${pr.number}: ${previousStatus} → ${status}`);
});
```

### Dynamic Repository Discovery

```typescript
const watcher = client.watch({
  repos: ["owner/main-repo"],
  discoverRepos: async () => {
    const { data: repositories } = await client.getOwnerRepos("owner");
    return repositories
      .filter(repo => repo.fork === false && repo.language === "TypeScript")
      .map(repo => repo.fullName);
  },
});
```

### Throttling Integration

```typescript
const throttle = {
  async wait(weight: number) {
    // Implement custom rate limiting
    await new Promise(resolve => setTimeout(resolve, weight * 100));
  },
};

const watcher = client.watch({
  repos: ["owner/repo"],
  throttle,
});
```

### Stale PR Cleanup

```typescript
const watcher = client.watch({
  repos: ["owner/repo"],
  stalePRThresholdMs: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

## URL Parsing Utilities

### parseGitHubFileUrl(url)

Parses a GitHub file URL to extract owner, repo, branch, and path.

```typescript
const info = parseGitHubFileUrl("https://github.com/owner/repo/blob/main/src/index.ts");
// => { owner: "owner", repo: "repo", branch: "main", filePath: "src/index.ts" }
```

### parseGitHubDirectoryUrl(url)

Parses a GitHub directory URL to extract owner, repo, branch, and directory path.

```typescript
const info = parseGitHubDirectoryUrl("https://github.com/owner/repo/tree/main/src");
// => { owner: "owner", repo: "repo", branch: "main", dirPath: "src" }
```

## Tree Diff Utilities

### diffTree(blobs, manifest)

Compares the current git tree against a manifest of previously processed blob SHAs.

```typescript
const { changedFiles, removedFiles, staleDirs } = diffTree(entries, manifest);
// changedFiles: new/modified files
// removedFiles: deleted paths
// staleDirs: directories containing changed/removed files
```

### collectDirectories(filePaths)

Collects all ancestor directory paths from a list of file paths.

```typescript
const dirs = collectDirectories(["src/index.ts", "lib/utils.ts"]);
// => ["", "src", "lib"]
```

### groupByDirectory(filePaths)

Groups file paths by their immediate parent directory.

```typescript
const groups = groupByDirectory(["src/index.ts", "lib/utils.ts"]);
// => Map([ "src" => ["index.ts"], "lib" => ["utils.ts"] ])
```

## Timeline Utilities

### buildTimeline(comments, reviews, commits)

Merges PR timeline entries into a chronologically sorted array.

```typescript
const timeline = buildTimeline(comments, reviews, commits);
// => TimelineEntry[]
```

### formatTimeline(entries)

Formats a timeline as readable markdown text.

```typescript
const formatted = formatTimeline(timeline);
// "[2024-01-15 10:30] 💬 @alice (comment): Looks good\n[...]"
```

### TimelineEntry

```typescript
interface TimelineEntry {
  kind: "comment" | "review" | "commit";
  timestamp: string;
  author: string;
  body: string;
  reviewState?: string;
  commitSha?: string;
}
```

## Types

All exported types are included below:

### PR-related Types

- `PullRequest`: Full PR object with titles, states, labels, reviewers, mergeability
- `PullRequestFile`: Modified file metadata (`added`, `removed`, `modified`, etc.)
- `PullRequestCommit`: Commit details with author and message
- `PullRequestReview`: Review object with state (`APPROVED`, `CHANGES_REQUESTED`, etc.)
- `PullRequestComment`: Comment with author and timestamp

### Repository Types

- `Repository`: GitHub repository metadata
- `ContributionRepo`: Minimal repo info for contribution tracking
- `TreeEntry`: Git tree entry with path, type, and SHA

### Watcher Types

- `WatchOptions`: Configuration for `PRWatcher`
- `WatchThrottle`: Interface for rate-limiting (compatible with `@hardlydifficult/throttle`)
- `ClassifyPR`: Function to compute custom PR status
- `DiscoverRepos`: Function to discover repositories dynamically
- `PREvent`: Base event for PR actions
- `PRStatusEvent`: Event with user-defined status
- `StatusChangedEvent`: Status change with previous value
- `CommentEvent`, `ReviewEvent`, `CheckRunEvent`: Activity-specific events
- `PRUpdatedEvent`: Draft/status/label changes
- `PollCompleteEvent`: Emitted at end of each poll cycle
- `PushEvent`: HEAD SHA change for watched repos

### Git API Types

- `CommitAuthor`: Name and email
- `CommitFile`: Path and content
- `CommitFilesOptions`: Parameters for `repo.commitFiles`
- `CommitResult`: Result of a file commit
- `CreatePROptions`: Parameters for `repo.createPR`
- `CreatedPR`: Result of PR creation

## Setup

You must provide a GitHub personal access token via the `token` parameter or `GH_PAT` environment variable. The token requires `repo` scope for full read/write access.

## Appendix

| Operation | Rate Limiting | Notes |
|------|---|-----|
| `getOwnerRepos` | Uses `repos.listForOrg` or `repos.listForUser` | Falls back to user if org is not found |
| `fetchWatchedPRs` | 1 call per repo + 1 for `myPRs` if enabled | De-duplicates PRs |
| `fetchPRActivitySelective` | Caches comments/reviews; checks check runs only when PR changed | Reduces API calls by up to 2/3 |
| `branchHeadTracker` | Zero-cost if default branch was harvested from PR data | otherwise 1 call per repo |
| `classifyPR` | Executed per PR per poll cycle | User responsibility to manage internal rate limits |

## License

MIT