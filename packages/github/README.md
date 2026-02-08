# @hardlydifficult/github

Typed GitHub API client wrapping Octokit with a chainable API.

## Install

```bash
npm install @hardlydifficult/github
```

## Usage

```typescript
import { GitHubClient } from "@hardlydifficult/github";

// Create client — token defaults to GH_PAT env var
const github = await GitHubClient.create();
const github = await GitHubClient.create("ghp_...");

// Repo-level
const repo = github.repo("owner", "repo");
const prs = await repo.getOpenPRs();
const repoInfo = await repo.get();

// PR-level (chainable from repo)
const pr = repo.pr(42);
const data = await pr.get();
const diff = await pr.getDiff();
const files = await pr.getFiles();
const commits = await pr.getCommits();
const reviews = await pr.getReviews();
const comments = await pr.getComments();
const checkRuns = await pr.getCheckRuns();
await pr.postComment("LGTM!");
await pr.merge("feat: my feature (#42)");

// Owner-level
const repos = await github.getOwnerRepos("owner");

// User-level (uses auto-resolved username)
const contributed = await github.getContributedRepos(30);
const myPRs = await github.getMyOpenPRs();
```

## API

### `GitHubClient`

| Method | Description |
|--------|-------------|
| `static create(token?)` | Create client (token defaults to `GH_PAT` env var) |
| `repo(owner, name)` | Get a `RepoClient` scoped to owner/repo |
| `getOwnerRepos(owner)` | List repos for a user or org |
| `getContributedRepos(days)` | Find repos the user contributed to recently |
| `getMyOpenPRs()` | Find open PRs by the authenticated user |

### `RepoClient`

| Method | Description |
|--------|-------------|
| `pr(number)` | Get a `PRClient` scoped to a pull request |
| `getOpenPRs()` | List open pull requests |
| `get()` | Get repository info |

### `PRClient`

| Method | Description |
|--------|-------------|
| `get()` | Get pull request details |
| `getDiff()` | Get PR diff as string |
| `getFiles()` | List files changed in the PR |
| `getCommits()` | List commits in the PR |
| `getReviews()` | List reviews on the PR |
| `getComments()` | List comments on the PR |
| `getCheckRuns()` | List check runs (auto-resolves head SHA) |
| `postComment(body)` | Post a comment on the PR |
| `merge(title)` | Squash-merge the PR |

### Types

`PullRequest`, `Repository`, `User`, `CheckRun`, `PullRequestReview`, `PullRequestComment`, `PullRequestFile`, `PullRequestCommit`, `Label`, `ContributionRepo`, `MergeableState`
