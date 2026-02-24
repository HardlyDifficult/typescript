# @hardlydifficult/pr-analyzer

A TypeScript package for analyzing GitHub pull requests and classifying them into actionable buckets.

## Installation

```bash
npm install @hardlydifficult/pr-analyzer
```

## Quick Start

```typescript
import { GitHubClient } from "@hardlydifficult/github";
import { scanSinglePR } from "@hardlydifficult/pr-analyzer";

// Create a GitHub client
const client = new GitHubClient({ token: "ghp_..." });

// Scan a PR
const pr = await scanSinglePR(
  client,
  "@cursor",
  "owner",
  "repo",
  123
);

// Check status and available actions
console.log(pr.status); // "ready_to_merge"
console.log(pr.ciSummary); // "CI passed: 3 checks"

import { getAvailableActions } from "@hardlydifficult/pr-analyzer";
const actions = getAvailableActions(pr);
// actions = [{ type: "merge", label: "Merge", description: "Squash and merge this PR" }]
```

## Core Features

### Scanning and Analyzing PRs

#### `analyzePR`

Analyzes a single PR and returns its full status.

```typescript
import { analyzePR, analyzeAll } from "@hardlydifficult/pr-analyzer";

const pr = await client.repo("owner", "repo").pr(123).get();
const scanned = await analyzePR(client, "owner", "repo", pr, "@bot");

scanned.status; // "ready_to_merge"
scanned.hasConflicts; // false
scanned.daysSinceUpdate; // 2
```

#### `analyzeAll`

Analyzes multiple PRs in parallel, logging failures.

```typescript
import type { DiscoveredPR } from "@hardlydifficult/pr-analyzer";

const prs: readonly DiscoveredPR[] = [
  { pr: pr1, repoOwner: "owner", repoName: "repo" },
  { pr: pr2, repoOwner: "owner", repoName: "repo" },
];

const results = await analyzeAll(prs, client, "@bot");
// results = [scannedPR1, scannedPR2]
```

#### `scanSinglePR`

Scans a single PR directly by repo and number (real-time event handling).

```typescript
import { scanSinglePR } from "@hardlydifficult/pr-analyzer";

const pr = await scanSinglePR(client, "@cursor", "owner", "repo", 456);
```

### PR Status Determination

PRs are classified into core statuses based on priority:

1. `draft` — PR is a draft
2. `ci_running` — CI checks are in progress
3. `ci_failed` — At least one CI check failed
4. `has_conflicts` — PR has merge conflicts
5. `waiting_on_bot` — A bot was mentioned and hasn’t responded
6. `changes_requested` — A reviewer requested changes
7. `ready_to_merge` — CI passed and no conflicts
8. `approved` — PR approved (but not all CI passed)
9. `needs_review` — No reviews or approvals yet

Extensions via `AnalyzerHooks.resolveStatus` allow custom statuses.

```typescript
const hooks = {
  resolveStatus: (coreStatus, details) => {
    if (coreStatus === "ci_failed" && details.checks.some(c => c.name === "CI")) {
      return "ai_processing";
    }
    return undefined; // keep core status
  },
};

const pr = await analyzePR(client, "owner", "repo", pr, "@bot", hooks);
console.log(pr.status); // e.g. "ai_processing"
```

### Classification

Classifies PRs into action buckets: `readyForHuman`, `needsBotBump`, `inProgress`, `blocked`.

```typescript
import { classifyPRs } from "@hardlydifficult/pr-analyzer";

const result = classifyPRs([scannedPR1, scannedPR2]);
result.readyForHuman; // PRs needing human review/merge
result.needsBotBump;  // PRs waiting on bot response
result.inProgress;    // PRs with CI running
result.blocked;       // PRs stalled (draft, failed CI, conflicts)
```

#### ClassificationConfig

Extend buckets with custom statuses:

```typescript
const config = {
  readyForHuman: ["custom_status"],
  inProgress: ["ai_processing"],
  blocked: ["custom_blocked"],
  needsBotBump: ["custom_waiting"],
};

const result = classifyPRs(prs, config);
```

### Available Actions

Determines which actions are available for a PR based on its status.

#### Core Actions

- `merge` — Available for `ready_to_merge`, `approved`
- `mark_ready` — Available for `draft` when CI passed and no conflicts
- `enable_auto_merge` — Available for `ci_running`, `needs_review` when PR is not draft, not merged, no conflicts

```typescript
import { getAvailableActions, PR_ACTIONS } from "@hardlydifficult/pr-analyzer";

const actions = getAvailableActions(pr);
// [{ type: "merge", label: "Merge", description: "Squash and merge this PR" }]
```

#### Custom Actions

Consumers can define extra actions with custom conditions.

```typescript
import { ActionDefinition } from "@hardlydifficult/pr-analyzer";

const fixCiAction: ActionDefinition = {
  type: "fix_ci",
  label: "Fix CI",
  description: "Post @cursor fix CI comment",
  when: (pr, ctx) => pr.status === "ci_failed" && ctx["isWorkPR"] === true,
};

const actions = getAvailableActions(pr, [fixCiAction], { isWorkPR: true });
```

## Types and Interfaces

| Type | Description |
|------|-------------|
| `ScannedPR` | A fully analyzed PR with status, CI summary, and metadata |
| `ScanResult` | Classified PR buckets: `all`, `readyForHuman`, `needsBotBump`, `inProgress`, `blocked` |
| `AnalyzerHooks` | Custom logic hook: `resolveStatus(coreStatus, details)` |
| `ClassificationConfig` | Extend status buckets with custom statuses |
| `ActionDefinition` | Define custom actions with conditional logic |
| `CorePRStatus` | Core PR status enum (`draft`, `ci_running`, etc.) |
| `CIStatus` | CI analysis: `isRunning`, `hasFailed`, `allPassed`, `summary` |
| `Logger` | Logging interface (`info`, `error`) |

## Appendix

### Core Status Priority

Status determination follows this priority:

1. Draft PR → `"draft"`
2. CI running → `"ci_running"`
3. CI failed → `"ci_failed"`
4. Merge conflicts → `"has_conflicts"`
5. Waiting on bot → `"waiting_on_bot"`
6. Changes requested → `"changes_requested"`
7. CI passed and no conflicts → `"ready_to_merge"`
8. At least one approval → `"approved"`
9. Default → `"needs_review"`

### CI Check Status Detection

- **Running**: `status: "in_progress"` or `status: "queued"` or `conclusion: null`
- **Failed**: `status: "completed"` and `conclusion` is `"failure"`, `"timed_out"`, `"cancelled"`, or `"action_required"`
- **Passed**: `status: "completed"` and `conclusion` is `"success"`, `"skipped"`, or `"neutral"`
- **Uncategorized checks**: Treated as running if no definitive state

Bot detection includes common bots: `cursor`, `cursor-bot`, `github-actions`, `dependabot`, `renovate`, `codecov`, `vercel`, `claude`, plus any username ending in `[bot]` or containing `bot`.