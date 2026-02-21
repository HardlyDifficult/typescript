# @hardlydifficult/pr-analyzer

A GitHub PR analyzer that classifies pull requests by status and determines available actions (merge, mark ready, auto-merge).

## Installation

```bash
npm install @hardlydifficult/pr-analyzer
```

## Quick Start

```typescript
import { GitHubClient } from "@hardlydifficult/github";
import { scanSinglePR } from "@hardlydifficult/pr-analyzer";

const client = new GitHubClient({ token: process.env.GITHUB_TOKEN! });

const pr = await scanSinglePR(
  client,
  "@cursor",
  "HardlyDifficult",
  "typescript",
  123
);

console.log(pr.status); // e.g., "ready_to_merge"
console.log(pr.ciSummary); // e.g., "CI passed: 2 checks"

const actions = getAvailableActions(pr);
console.log(actions.map(a => a.label)); // e.g., ["Merge"]
```

## Analysis

Analyzes a PR's status by fetching CI checks, comments, reviews, and merge conflicts, then determines its readiness.

### `analyzePR`

Analyzes a single PR and returns detailed status.

```typescript
import { GitHubClient } from "@hardlydifficult/github";
import { analyzePR } from "@hardlydifficult/pr-analyzer";

const client = new GitHubClient({ token: process.env.GITHUB_TOKEN! });

const pr = await client
  .repo("owner", "repo")
  .pr(42)
  .get();

const result = await analyzePR(client, "owner", "repo", pr, "@bot");
console.log(result.status); // "ready_to_merge", "ci_failed", etc.
console.log(result.ciSummary); // Human-readable CI summary
console.log(result.hasConflicts); // true if merge conflicts exist
console.log(result.waitingOnBot); // true if PR is waiting on bot response
console.log(result.daysSinceUpdate); // Days since last update
```

### `analyzeAll`

Analyzes multiple discovered PRs, skipping those that fail.

```typescript
import { analyzeAll } from "@hardlydifficult/pr-analyzer";

interface DiscoveredPR {
  pr: PullRequest;
  repoOwner: string;
  repoName: string;
}

const prs: DiscoveredPR[] = [
  { pr: pr1, repoOwner: "owner", repoName: "repo" },
  { pr: pr2, repoOwner: "owner", repoName: "other" },
];

const results = await analyzeAll(prs, client, "@bot", logger);
```

### `scanSinglePR`

Real-time PR scan for event handling (e.g., webhook, cron).

```typescript
import { scanSinglePR } from "@hardlydifficult/pr-analyzer";

const pr = await scanSinglePR(
  client,
  "@cursor",
  "owner",
  "repo",
  123
);
```

### Hooks

Customize status resolution with hooks:

```typescript
import { analyzePR, type AnalyzerHooks } from "@hardlydifficult/pr-analyzer";

const hooks: AnalyzerHooks = {
  resolveStatus(coreStatus, details) {
    if (coreStatus === "ci_failed") {
      return "ai_processing";
    }
    return undefined;
  },
};

const result = await analyzePR(client, "owner", "repo", pr, "@bot", hooks);
```

## Classification

Classifies PRs into buckets based on status: `readyForHuman`, `needsBotBump`, `inProgress`, `blocked`.

```typescript
import { classifyPRs } from "@hardlydifficult/pr-analyzer";

const buckets = classifyPRs(results);
console.log(buckets.readyForHuman.length); // PRs needing human action
console.log(buckets.needsBotBump.length); // PRs waiting on bot
console.log(buckets.inProgress.length); // PRs with CI running
console.log(buckets.blocked.length); // PRs stuck (draft, failed, conflicts)
```

### Extending Classification

Add custom statuses to buckets via `ClassificationConfig`:

```typescript
const config: ClassificationConfig = {
  readyForHuman: ["custom_ready"],
  inProgress: ["ai_processing"],
  blocked: ["custom_blocked"],
  needsBotBump: ["custom_waiting"],
};

const buckets = classifyPRs(results, config);
```

## Actions

Determines which actions are available for a PR based on its status.

### Core Actions

| Type | Available When | Description |
|------|----------------|-------------|
| `"merge"` | `ready_to_merge`, `approved` | Squash and merge |
| `"mark_ready"` | `draft` with CI passed & no conflicts | Mark draft as ready |
| `"enable_auto_merge"` | `ci_running`, `needs_review` | Enable auto-merge |

```typescript
import { getAvailableActions } from "@hardlydifficult/pr-analyzer";

const actions = getAvailableActions(pr);
// e.g., [{ type: "merge", label: "Merge", description: "Squash and merge this PR" }]
```

### Custom Actions

Define extra actions that trigger on conditions:

```typescript
import { getAvailableActions, type ActionDefinition } from "@hardlydifficult/pr-analyzer";

const fixCiAction: ActionDefinition = {
  type: "fix_ci",
  label: "Fix CI",
  description: "Post @cursor fix CI comment",
  when: (pr, ctx) => pr.status === "ci_failed" && ctx["isWorkPR"] === true,
};

const actions = getAvailableActions(pr, [fixCiAction], { isWorkPR: true });
```

## Types

### Core Statuses

| Status | Meaning |
|--------|---------|
| `"draft"` | Draft PR |
| `"ci_running"` | CI checks in progress |
| `"ci_failed"` | CI checks failed |
| `"needs_review"` | CI passed, no reviews yet |
| `"changes_requested"` | Review requests changes |
| `"approved"` | Review approved |
| `"has_conflicts"` | Merge conflicts |
| `"ready_to_merge"` | CI passed, approved, no conflicts |
| `"waiting_on_bot"` | Bot mentioned but not replied |

### ScannedPR

```typescript
interface ScannedPR {
  pr: PullRequest;
  repo: Repository;
  status: string; // core or custom status
  ciStatus: CIStatus;
  ciSummary: string;
  hasConflicts: boolean;
  waitingOnBot: boolean;
  daysSinceUpdate: number;
}
```

### CIStatus

```typescript
interface CIStatus {
  isRunning: boolean;
  hasFailed: boolean;
  allPassed: boolean;
  summary: string;
}
```