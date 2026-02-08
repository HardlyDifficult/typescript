# @hardlydifficult/github

Typed GitHub API client wrapping Octokit.

## Install

```bash
npm install @hardlydifficult/github
```

## Usage

```typescript
import { GitHubClient } from "@hardlydifficult/github";

const github = new GitHubClient("ghp_token", "myusername");

const prs = await github.getOpenPRs("owner", "repo");
const pr = await github.getPR("owner", "repo", 42);
const diff = await github.getPRDiff("owner", "repo", 42);

await github.postComment("owner", "repo", 42, "LGTM!");
await github.mergePR("owner", "repo", 42, "feat: new feature (#42)");
```

## API

### `new GitHubClient(token, username)`

| Method | Description |
|--------|-------------|
| `getOpenPRs(owner, repo)` | List open pull requests |
| `getPR(owner, repo, prNumber)` | Get a single PR |
| `getPRDiff(owner, repo, prNumber)` | Get PR diff as string |
| `getPRFiles(owner, repo, prNumber)` | List files changed in a PR |
| `getPRCommits(owner, repo, prNumber)` | List commits in a PR |
| `getPRReviews(owner, repo, prNumber)` | List reviews on a PR |
| `getPRComments(owner, repo, prNumber)` | List comments on a PR |
| `getCheckRuns(owner, repo, ref)` | List check runs for a ref |
| `postComment(owner, repo, prNumber, body)` | Post a comment on a PR |
| `mergePR(owner, repo, prNumber, title)` | Squash-merge a PR |
| `getRepository(owner, repo)` | Get repository info |
| `getOwnerRepos(owner)` | List repos for a user or org |
| `getContributedRepos(days)` | Find repos the user contributed to recently |
| `getMyOpenPRs()` | Find open PRs by the authenticated user |

### Types

`PullRequest`, `Repository`, `User`, `CheckRun`, `PullRequestReview`, `PullRequestComment`, `PullRequestFile`, `PullRequestCommit`, `Label`, `ContributionRepo`, `MergeableState`
