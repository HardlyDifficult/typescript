# @hardlydifficult/pr-analyzer

GitHub PR analyzer that classifies pull requests and determines available actions like merge, mark ready, and auto-merge.

## Installation

```bash
npm install @hardlydifficult/pr-analyzer
```

## Quick Start

```typescript
import { scanSinglePR } from "@hardlydifficult/pr-analyzer";
import { GitHubClient } from "@hardlydifficult/github";

const client = new GitHubClient(process.env.GITHUB_TOKEN!);
const pr = await scanSinglePR(
  client,
  "@cursor",                 // Bot mention command
  "HardlyDifficult",         // Owner
  "typescript",              // Repo
  42,                        // PR number
);

console.log(pr.status);       // e.g. "ready_to_merge"
console.log(pr.ciSummary);    // e.g. "CI passed: 1 checks"
```

## Core Features

### Scanning and Analyzing PRs

Scan a single PR in real-time using GitHub client, repository owner, repo name, and PR number.

```typescript
import { scanSinglePR, analyzeAll } from "@hardlydifficult/pr-analyzer";
import type { DiscoveredPR, AnalyzerHooks, Logger } from "@hardlydifficult/pr-analyzer";

// Scan a single PR
const pr = await scanSinglePR(client, "@bot", "owner", "repo", 42);

// Analyze a batch of discovered PRs
const discovered: DiscoveredPR[] = [
  { pr, repoOwner: "owner", repoName: "repo" },
];
const results = await analyzeAll(discovered, client, "@bot", console as Logger);
```

### PR Status Determination

Core statuses are derived from GitHub data:

- `"draft"` — PR is in draft state
- `"ci_running"` — CI checks are in progress
- `"ci_failed"` — At least one CI check failed
- `"needs_review"` — No reviewer approval yet
- `"changes_requested"` — A reviewer requested changes
- `"approved"` — At least one reviewer approved
- `"has_conflicts"` — Merge conflicts detected
- `"ready_to_merge"` — CI passed, no conflicts, approved
- `"waiting_on_bot"` — Bot was mentioned and has not replied

You can extend status determination via `AnalyzerHooks.resolveStatus`.

```typescript
const hooks: AnalyzerHooks = {
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

Classify PRs into action buckets.

```typescript
import { classifyPRs } from "@hardlydifficult/pr-analyzer";

const result = classifyPRs(results);
console.log(result.readyForHuman); // PRs needing human review/merge
console.log(result.inProgress);    // PRs with CI running
console.log(result.blocked);       // PRs blocked (draft, failed CI, conflicts)
console.log(result.needsBotBump);  // PRs waiting on bot response
```

Extend classification buckets with custom statuses via `ClassificationConfig`.

```typescript
const config: ClassificationConfig = {
  inProgress: ["ai_processing"],
  blocked: ["security_review"],
};
const result = classifyPRs(results, config);
```

### Available Actions

Determine available actions for a PR.

```typescript
import { getAvailableActions, PR_ACTIONS } from "@hardlydifficult/pr-analyzer";

const actions = getAvailableActions(pr);
console.log(actions.map(a => a.label)); // e.g. ["Merge", "Enable Auto-Merge"]
```

Core actions:

| Type             | Label         | Description                              |
|------------------|---------------|------------------------------------------|
| `"merge"`        | `"Merge"`     | Squash and merge this PR                 |
| `"mark_ready"`   | `"Mark Ready"`| Mark this draft PR as ready for review   |
| `"enable_auto_merge"` | `"Enable Auto-Merge"` | Enable GitHub auto-merge when checks pass |

Add custom actions with `ActionDefinition`.

```typescript
const extraActions: ActionDefinition[] = [
  {
    type: "fix_ci",
    label: "Fix CI",
    description: "Post @cursor fix CI comment",
    when: (pr, ctx) => pr.status === "ci_failed" && ctx["isWorkPR"] === true,
  },
];

const actions = getAvailableActions(pr, extraActions, { isWorkPR: true });
```

## Types and Interfaces

```typescript
import type {
  ScannedPR,
  CIStatus,
  ScanResult,
  AnalyzerHooks,
  ClassificationConfig,
  ActionDefinition,
  CorePRStatus,
  Logger,
} from "@hardlydifficult/pr-analyzer";
```

| Interface/Type      | Purpose |
|---------------------|---------|
| `ScannedPR`         | Full PR data after analysis |
| `CIStatus`          | CI check summary (running, failed, passed) |
| `ScanResult`        | PRs grouped into buckets |
| `AnalyzerHooks`     | Extend status determination |
| `ClassificationConfig` | Extend classification buckets |
| `ActionDefinition`  | Define custom PR actions |
| `CorePRStatus`      | Built-in status types |
| `Logger`            | Interface for logging info/errors |

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