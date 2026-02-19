I'll analyze the package structure and source code to generate a comprehensive README.Now let me read the main client files to understand the API:Now let me read the PRWatcher and timeline files:Now let me check the test files for usage examples:Now let me check the polling files to understand the activity types:Now I have enough information to write the comprehensive README. Let me create it:

# @hardlydifficult/github

Typed GitHub API client wrapping Octokit with chainable APIs for repositories, pull requests, and real-time PR polling.

## Install

```bash
npm install @hardlydifficult/github
```

## Quick Start

```typescript
import { GitHubClient } from "@hardlydifficult/github";

// Create client — token defaults to GH_PAT env var
const github = await GitHubClient.create();

// Access a repository
const repo = github.repo("owner", "repo");
const prs = await repo.getOpenPRs();

// Access a pull request
const pr = repo.pr(42);
const data = await pr.get();
const comments = await pr.getComments();
```

## API Reference

### GitHubClient

Top-level client for GitHub API operations.

#### `static create(token?: string): Promise<GitHubClient>`

Create an authenticated GitHub client. Token defaults to the `GH_PAT` environment variable.

```typescript
const github = await GitHubClient.create();
const github = await GitHubClient.create("ghp_...");
```

#### `repo(owner: string, name: string): RepoClient`

Get a client scoped to a specific repository.

```typescript
const repo = github.repo("HardlyDifficult", "typescript");
```

#### `watch(options: WatchOptions): PRWatcher`

Create a watcher for polling PR activity across repositories.

```typescript
const watcher = github.watch({
  repos: ["owner/repo1", "owner/repo2"],
  myPRs: true,
  intervalMs: 30_000,
});
```

#### `getOwnerRepos(owner: string): Promise<ContributionRepo[]>`

List all public repositories for a user or organization.

```typescript
const repos = await github.getOwnerRepos("HardlyDifficult");
// [{ owner: "HardlyDifficult", name: "typescript", fullName: "HardlyDifficult/typescript" }, ...]
```

#### `getContributedRepos(days: number): Promise<ContributionRepo[]>`

Find repositories the authenticated user has contributed to in the last N days.

```typescript
const recent = await github.getContributedRepos(30);
```

#### `getMyOpenPRs(): Promise<{ pr: PullRequest; repo: { owner: string; name: string } }[]>`

Get all open pull requests authored by the authenticated user.

```typescript
const myPRs = await github.getMyOpenPRs();
```

---

### RepoClient

Client for repository-level operations.

#### `pr(number: number): PRClient`

Get a client scoped to a specific pull request.

```typescript
const pr = repo.pr(42);
```

#### `getOpenPRs(): Promise<PullRequest[]>`

List all open pull requests in the repository.

```typescript
const prs = await repo.getOpenPRs();
```

#### `get(): Promise<Repository>`

Get repository metadata.

```typescript
const info = await repo.get();
// { id, name, full_name, owner, html_url, default_branch, description }
```

#### `getFileTree(sha?: string): Promise<FileTreeResult>`

Get the complete file tree for a commit (defaults to HEAD).

```typescript
const tree = await repo.getFileTree();
// { entries: [{ path, type, sha, size? }], rootSha }
```

#### `getFileContent(filePath: string, ref?: string): Promise<string>`

Get the content of a file at a specific ref (defaults to HEAD).

```typescript
const content = await repo.getFileContent("package.json");
```

#### `gatherContext(filesToFetch: string[], maxFileChars: number): Promise<RepoContext>`

Fetch file tree and specific key files for AI context gathering.

```typescript
const context = await repo.gatherContext(
  ["package.json", "README.md"],
  5000
);
// { filePaths: [...], keyFiles: [{ path, content }, ...] }
```

#### `getDefaultBranchHeadSha(): Promise<string>`

Get the HEAD commit SHA of the repository's default branch.

```typescript
const sha = await repo.getDefaultBranchHeadSha();
```

#### `getBranchSha(branch: string): Promise<string | null>`

Get the SHA of a branch. Returns null if the branch doesn't exist.

```typescript
const sha = await repo.getBranchSha("main");
```

#### `mergeBranch(base: string, head: string): Promise<string | null>`

Merge a head branch into a base branch. Returns the merge commit SHA, or null if already up-to-date.

```typescript
const mergeCommitSha = await repo.mergeBranch("main", "feature");
```

#### `createBranch(branch: string, sha: string): Promise<void>`

Create a new branch pointing to a commit SHA.

```typescript
await repo.createBranch("feature", "abc123def456");
```

#### `updateBranch(branch: string, sha: string): Promise<void>`

Update an existing branch to point to a new commit SHA.

```typescript
await repo.updateBranch("feature", "newsha789");
```

#### `createPR(options: CreatePROptions): Promise<CreatedPR>`

Create a pull request.

```typescript
const created = await repo.createPR({
  head: "feature",
  base: "main",
  title: "Add new feature",
  body: "This PR adds...",
});
// { number: 42, url: "https://github.com/..." }
```

#### `commitFiles(options: CommitFilesOptions): Promise<CommitResult>`

Create blobs, build a tree, commit, and create or update a branch ref in one operation.

```typescript
const result = await repo.commitFiles({
  branch: "feature",
  files: [
    { path: "src/index.ts", content: "export const x = 1;" },
    { path: "README.md", content: "# My Project" },
  ],
  message: "Initial commit",
  parentSha: "abc123",
  author: { name: "Alice", email: "alice@example.com" },
});
// { commitSha: "def456", branchCreated: true }
```

---

### PRClient

Client for pull request-level operations.

#### `get(): Promise<PullRequest>`

Get pull request details.

```typescript
const pr = await pr.get();
// { number, title, body, state, draft, user, labels, mergeable_state, ... }
```

#### `getDiff(): Promise<string>`

Get the PR diff as a unified diff string.

```typescript
const diff = await pr.getDiff();
```

#### `getFiles(): Promise<PullRequestFile[]>`

List files changed in the PR.

```typescript
const files = await pr.getFiles();
// [{ filename, status, additions, deletions, patch?, ... }, ...]
```

#### `getCommits(): Promise<PullRequestCommit[]>`

List commits in the PR.

```typescript
const commits = await pr.getCommits();
// [{ sha, commit: { message, author }, author, html_url }, ...]
```

#### `getReviews(): Promise<PullRequestReview[]>`

List reviews on the PR.

```typescript
const reviews = await pr.getReviews();
// [{ user, body, state: "APPROVED" | "CHANGES_REQUESTED" | ..., submitted_at }, ...]
```

#### `getComments(): Promise<PullRequestComment[]>`

List comments on the PR.

```typescript
const comments = await pr.getComments();
// [{ user, body, created_at, updated_at, html_url }, ...]
```

#### `getCheckRuns(): Promise<CheckRun[]>`

List check runs on the PR (auto-resolves head SHA).

```typescript
const checks = await pr.getCheckRuns();
// [{ name, status: "queued" | "in_progress" | "completed", conclusion, ... }, ...]
```

#### `getTimeline(): Promise<TimelineEntry[]>`

Get a merged, chronologically sorted timeline of comments, reviews, and commits.

```typescript
const timeline = await pr.getTimeline();
// [{ kind: "comment" | "review" | "commit", timestamp, author, body, ... }, ...]
```

#### `postComment(body: string): Promise<void>`

Post a comment on the PR.

```typescript
await pr.postComment("LGTM! 🚀");
```

#### `merge(title: string): Promise<void>`

Squash-merge the PR with the given commit title.

```typescript
await pr.merge("feat: add new feature (#42)");
```

#### `markReady(): Promise<void>`

Mark a draft PR as ready for review.

```typescript
await pr.markReady();
```

#### `enableAutoMerge(mergeMethod?: "SQUASH" | "MERGE" | "REBASE"): Promise<void>`

Enable auto-merge on the PR (requires GraphQL).

```typescript
await pr.enableAutoMerge("SQUASH");
```

---

### PRWatcher

Polls GitHub for PR activity and emits events. Created via `github.watch(options)`.

#### `start(): Promise<PRStatusEvent[]>`

Begin polling (performs initial poll, then sets up interval). Returns initial PR statuses if `classifyPR` is provided.

```typescript
const initial = await watcher.start();
// [{ pr, repo, status }, ...]
```

#### `stop(): void`

Stop polling.

```typescript
watcher.stop();
```

#### `getWatchedPRs(): PREvent[]`

Get current snapshot of all tracked PRs.

```typescript
const tracked = watcher.getWatchedPRs();
```

#### `addRepo(repo: string): void`

Start watching a new repository (`"owner/repo"` format).

```typescript
watcher.addRepo("other/lib");
```

#### `removeRepo(repo: string): void`

Stop watching a repository.

```typescript
watcher.removeRepo("owner/repo");
```

#### Event Subscriptions

All event methods return an unsubscribe function.

##### `onNewPR(callback: (event: PREvent) => void): () => void`

Fires when a new PR appears in a watched repo or user's PRs (on first poll, fires for all existing open PRs).

```typescript
watcher.onNewPR((event) => {
  console.log(`New PR: ${event.pr.title} in ${event.repo.owner}/${event.repo.name}`);
});
```

##### `onComment(callback: (event: CommentEvent) => void): () => void`

Fires when a new comment is posted on a tracked PR.

```typescript
watcher.onComment((event) => {
  console.log(`${event.comment.user.login} commented: ${event.comment.body}`);
});
```

##### `onReview(callback: (event: ReviewEvent) => void): () => void`

Fires when a new review is submitted on a tracked PR.

```typescript
watcher.onReview((event) => {
  console.log(`${event.review.user.login} ${event.review.state} #${event.pr.number}`);
});
```

##### `onCheckRun(callback: (event: CheckRunEvent) => void): () => void`

Fires when a check run is created or its status changes on a tracked PR.

```typescript
watcher.onCheckRun((event) => {
  console.log(`${event.checkRun.name}: ${event.checkRun.status} (${event.checkRun.conclusion})`);
});
```

##### `onPRUpdated(callback: (event: PRUpdatedEvent) => void): () => void`

Fires when PR metadata changes (draft status, labels, mergeable state).

```typescript
watcher.onPRUpdated((event) => {
  if (event.changes.draft) {
    console.log(`PR #${event.pr.number} ${event.changes.draft.to ? "converted to draft" : "marked ready"}`);
  }
  if (event.changes.labels) {
    console.log(`Labels changed from ${event.changes.labels.from.length} to ${event.changes.labels.to.length}`);
  }
});
```

##### `onMerged(callback: (event: PREvent) => void): () => void`

Fires when a tracked PR is merged.

```typescript
watcher.onMerged((event) => {
  console.log(`PR #${event.pr.number} was merged`);
});
```

##### `onClosed(callback: (event: PREvent) => void): () => void`

Fires when a tracked PR is closed without merge.

```typescript
watcher.onClosed((event) => {
  console.log(`PR #${event.pr.number} was closed`);
});
```

##### `onPollComplete(callback: (event: PollCompleteEvent) => void): () => void`

Fires after each poll cycle with a snapshot of all currently tracked PRs.

```typescript
watcher.onPollComplete((event) => {
  console.log(`Poll complete — tracking ${event.prs.length} PRs`);
});
```

##### `onStatusChanged(callback: (event: StatusChangedEvent) => void): () => void`

Fires when `classifyPR` returns a different status for a PR (only on subsequent polls, not initial).

```typescript
watcher.onStatusChanged((event) => {
  console.log(`PR #${event.pr.number} status: ${event.previousStatus} → ${event.status}`);
});
```

##### `onPush(callback: (event: PushEvent) => void): () => void`

Fires when the HEAD SHA of a watched repository's default branch changes.

```typescript
watcher.onPush((event) => {
  console.log(`Push to ${event.repo.owner}/${event.repo.name}:${event.branch}`);
  console.log(`  ${event.previousSha.slice(0, 7)} → ${event.sha.slice(0, 7)}`);
});
```

##### `onError(callback: (error: Error) => void): () => void`

Fires when polling or a callback throws an error.

```typescript
watcher.onError((error) => {
  console.error("Watcher error:", error.message);
});
```

---

### Timeline Utilities

#### `buildTimeline(comments: PullRequestComment[], reviews: PullRequestReview[], commits: PullRequestCommit[]): TimelineEntry[]`

Merge PR comments, reviews, and commits into a single chronologically sorted timeline.

```typescript
const timeline = buildTimeline(comments, reviews, commits);
// [{ kind: "comment" | "review" | "commit", timestamp, author, body, ... }, ...]
```

#### `formatTimeline(entries: TimelineEntry[]): string`

Format a timeline as readable markdown text.

```typescript
const text = formatTimeline(timeline);
// [2024-01-15 10:30] 💬 @alice (comment): Looks good but fix the import
// [2024-01-15 11:00] 📝 @bob (commit abc123): Fix import order
// [2024-01-15 11:30] ✅ @alice (review: approved): LGTM
```

---

### Tree Diffing Utilities

#### `diffTree(blobs: TreeEntry[], manifest: FileManifest): TreeDiff`

Compare current git tree against a manifest to find what needs re-processing.

```typescript
const diff = diffTree(currentTree, previousManifest);
// { changedFiles: [...], removedFiles: [...], staleDirs: [...] }
```

#### `collectDirectories(filePaths: string[]): string[]`

Collect all unique directory paths from a set of file paths (sorted deepest first).

```typescript
const dirs = collectDirectories(["src/index.ts", "src/utils.ts", "README.md"]);
// ["src", ""]
```

#### `groupByDirectory(filePaths: string[]): Map<string, string[]>`

Group file paths by their immediate parent directory.

```typescript
const groups = groupByDirectory(["src/index.ts", "src/utils.ts", "README.md"]);
// Map { "src" => ["index.ts", "utils.ts"], "" => ["README.md"] }
```

---

## WatchOptions

Configuration for `github.watch(options)`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `