# @hardlydifficult/pr-analyzer

Analyzes and classifies GitHub pull requests by status, determining available actions and enabling custom logic via hooks.

## Installation

```bash
npm install @hardlydifficult/pr-analyzer
```

## Quick Start

Analyze a single PR and determine its status:

```typescript
import { scanSinglePR } from "@hardlydifficult/pr-analyzer";
import { createGitHubClient } from "@hardlydifficult/github";

const client = createGitHubClient(process.env.GITHUB_TOKEN);
const scanned = await scanSinglePR(
  client,
  "@cursor",
  "owner",
  "repo",
  42
);

console.log(scanned.status); // "ready_to_merge", "ci_running", "draft", etc.
console.log(scanned.ciStatus); // { isRunning, hasFailed, allPassed, summary }
```

## PR Analysis

Analyze a PR to fetch CI checks, reviews, comments, and determine its status.

### `analyzePR()`

Analyzes a single PR and returns detailed status information:

```typescript
import { analyzePR } from "@hardlydifficult/pr-analyzer";

const scanned = await analyzePR(
  client,
  "owner",
  "repo",
  prObject,
  "@cursor"
);

// Returns ScannedPR with:
// - status: Core status like "ready_to_merge", "ci_running", "draft", etc.
// - ciStatus: { isRunning, hasFailed, allPassed, summary }
// - hasConflicts: boolean
// - waitingOnBot: boolean (true if bot was mentioned but hasn't replied)
// - daysSinceUpdate: number
// - pr: Original PullRequest object
// - repo: Repository object
```

**Core statuses** (in priority order):
- `draft` — PR is in draft mode
- `ci_running` — CI checks are in progress
- `ci_failed` — One or more CI checks failed
- `has_conflicts` — PR has merge conflicts
- `waiting_on_bot` — Bot was mentioned but hasn't replied
- `changes_requested` — Reviewer requested changes
- `ready_to_merge` — All checks passed, no issues
- `approved` — PR is approved but CI not yet passed
- `needs_review` — Default status, awaiting review

### `analyzeAll()`

Analyzes multiple discovered PRs in sequence, logging failures:

```typescript
import { analyzeAll } from "@hardlydifficult/pr-analyzer";

const scanned = await analyzeAll(
  discoveredPRs,
  client,
  "@cursor",
  logger // optional Logger
);
```

### `scanSinglePR()`

Convenience function for real-time event handling — fetches and analyzes a PR by number:

```typescript
import { scanSinglePR } from "@hardlydifficult/pr-analyzer";

const scanned = await scanSinglePR(
  client,
  "@cursor",
  "owner",
  "repo",
  42
);
```

## Custom Status Logic

Override status determination with custom logic via `AnalyzerHooks`:

```typescript
import { analyzePR } from "@hardlydifficult/pr-analyzer";
import type { AnalyzerHooks } from "@hardlydifficult/pr-analyzer";

const hooks: AnalyzerHooks = {
  resolveStatus: (coreStatus, details) => {
    // Return custom status string to override, or undefined to keep core status
    if (coreStatus === "ci_failed" && details.checks.some(c => c.name === "lint")) {
      return "lint_failed";
    }
    return undefined;
  }
};

const scanned = await analyzePR(
  client,
  "owner",
  "repo",
  prObject,
  "@cursor",
  hooks
);
```

The `resolveStatus` hook receives:
- `coreStatus` — The determined core status
- `details` — `AnalysisDetails` with `comments`, `checks`, `reviews`, `ciStatus`, `hasConflicts`, `waitingOnBot`

## PR Classification

Classify analyzed PRs into action buckets for workflow management.

### `classifyPRs()`

Groups PRs into four buckets based on status:

```typescript
import { classifyPRs } from "@hardlydifficult/pr-analyzer";

const result = classifyPRs(scannedPRs);

// result.readyForHuman — needs_review, changes_requested, approved, ready_to_merge
// result.needsBotBump — waiting_on_bot
// result.inProgress — ci_running
// result.blocked — draft, ci_failed, has_conflicts
// result.all — all PRs
```

### Extending Classification

Add custom statuses to buckets via `ClassificationConfig`:

```typescript
const result = classifyPRs(scannedPRs, {
  readyForHuman: ["custom_ready"],
  inProgress: ["ai_processing"],
  blocked: ["custom_blocked"],
  needsBotBump: ["custom_waiting"]
});
```

## PR Actions

Determine which actions are available for a PR based on its status.

### `getAvailableActions()`

Returns available actions for a PR:

```typescript
import { getAvailableActions } from "@hardlydifficult/pr-analyzer";

const actions = getAvailableActions(scannedPR);

// Returns PRActionDescriptor[] with type, label, description
// Example: [{ type: "merge", label: "Merge", description: "Squash and merge this PR" }]
```

**Core actions** (status-dependent):
- `merge` — Available for `ready_to_merge` or `approved` status
- `mark_ready` — Available for `draft` status when CI passed and no conflicts
- `enable_auto_merge` — Available for `ci_running` or `needs_review` status (non-draft, non-conflicting, unmerged)

### `PR_ACTIONS`

Reference object for core action metadata:

```typescript
import { PR_ACTIONS } from "@hardlydifficult/pr-analyzer";

console.log(PR_ACTIONS.merge);
// { label: "Merge", description: "Squash and merge this PR" }
```

### Custom Actions

Extend available actions with custom logic:

```typescript
import type { ActionDefinition } from "@hardlydifficult/pr-analyzer";

const customActions: ActionDefinition[] = [
  {
    type: "fix_ci",
    label: "Fix CI",
    description: "Post @cursor fix CI comment",
    when: (pr, ctx) => pr.status === "ci_failed" && ctx["isWorkPR"] === true
  }
];

const actions = getAvailableActions(scannedPR, customActions, {
  isWorkPR: true
});
```

The `when` function receives:
- `pr` — The `ScannedPR` object
- `context` — Key-value boolean flags for conditional logic

## Setup

### GitHub Authentication

Provide a GitHub token via environment variable or directly:

```typescript
import { createGitHubClient } from "@hardlydifficult/github";

const client = createGitHubClient(process.env.GITHUB_TOKEN);
```

### Bot Mention

Pass the bot mention string (e.g., `"@cursor"`) to analysis functions. The analyzer detects when this mention appears in PR comments and tracks whether the bot has replied.

### Logger (Optional)

Implement the `Logger` interface for error handling in `analyzeAll()`:

```typescript
import type { Logger } from "@hardlydifficult/pr-analyzer";

const logger: Logger = {
  info: (message, context) => console.log(message, context),
  error: (message, context) => console.error(message, context)
};

await analyzeAll(prs, client, "@cursor", logger);
```

## Appendix

### CI Status Determination

CI status is determined from GitHub check runs:

| Condition | Result |
|-----------|--------|
| Any check in `in_progress` or `queued` | `isRunning: true` |
| Any check with conclusion `failure`, `timed_out`, `cancelled`, or `action_required` | `hasFailed: true` |
| All checks with conclusion `success`, `skipped`, or `neutral` | `allPassed: true` |
| No checks | `allPassed: true`, `summary: "No CI checks"` |

### Review Status Determination

Latest review per reviewer is considered. If multiple reviews from the same user exist, only the most recent is used.

### Bot Detection

The analyzer recognizes these bot usernames (case-insensitive):
- `cursor`, `cursor-bot`
- `github-actions`, `github-actions[bot]`
- `dependabot`, `dependabot[bot]`
- `renovate`, `renovate[bot]`
- `codecov`, `codecov[bot]`
- `vercel`, `vercel[bot]`
- `claude`
- Any username ending with `[bot]` or containing `bot`