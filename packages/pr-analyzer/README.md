# @hardlydifficult/pr-analyzer

Opinionated pull request analysis for the way we actually use it.

Configure it once, then work with PR numbers, PR refs, or "my open PRs" directly. Results already include status buckets and available actions, so client code stays small and expressive.

## Installation

```bash
npm install @hardlydifficult/pr-analyzer
```

## Quick Start

```typescript
import { GitHubClient } from "@hardlydifficult/github";
import { createPRAnalyzer } from "@hardlydifficult/pr-analyzer";

const client = new GitHubClient({ token: process.env.GITHUB_TOKEN });

const prs = createPRAnalyzer({
  client,
  repo: "owner/repo",
});

const pr = await prs.analyze(123);
pr.status; // "ready_to_merge"
pr.actions; // [{ type: "merge", label: "Merge", ... }]

const inbox = await prs.mine();
inbox.readyForHuman.map((item) => item.pr.number);
```

## Why This API

- `repo` is configured once, so normal usage can just say `analyze(123)`.
- `bot` defaults to `@cursor`, because that is the common case.
- `analyze()` always returns an `ActionablePR`, so UI code does not need a second `getAvailableActions()` pass.
- `inbox()` and `mine()` return already-bucketed results for human review, bot bumps, in-progress work, and blocked PRs.
- `analyzeMany()` runs in parallel and skips failures instead of failing the whole batch.

## Main API

### `createPRAnalyzer(config)`

```typescript
const prs = createPRAnalyzer({
  client,
  repo: "owner/repo",
  bot: "@cursor",
});
```

Config:

- `client`: GitHub client with `repo(...).pr(...).snapshot()` support.
- `repo`: optional default repo. Required only if you want to analyze bare PR numbers.
- `bot`: optional bot mention. Defaults to `@cursor`.
- `hooks`: optional status override hook.
- `classify`: optional custom status buckets.
- `actions`: optional extra actions.
- `actionContext`: optional flags passed to extra actions.
- `logger`: optional logger used when bulk analysis skips failures.

Methods:

- `analyze(ref)`: analyze one PR and return an `ActionablePR`.
- `analyzeMany(refs)`: analyze many PRs in parallel.
- `inbox(refs)`: analyze and bucket a set of PRs.
- `mine()`: fetch and bucket your open PRs, optionally filtered to the configured repo.
- `classify(prs)`: bucket already-scanned PRs using this analyzer's defaults.
- `actionsFor(pr)`: compute actions for one scanned PR.

Accepted refs:

- `123` when `repo` is configured
- `"owner/repo#123"`
- GitHub PR URL
- raw `PullRequest`
- `DiscoveredPR`

## Custom Statuses And Actions

```typescript
import { createPRAnalyzer } from "@hardlydifficult/pr-analyzer";

const prs = createPRAnalyzer({
  client,
  repo: "owner/repo",
  hooks: {
    resolveStatus: (coreStatus, details) => {
      if (
        coreStatus === "ci_failed" &&
        details.checks.some((check) => check.name === "Cursor")
      ) {
        return "ai_processing";
      }
      return undefined;
    },
  },
  classify: {
    inProgress: ["ai_processing"],
  },
  actions: [
    {
      type: "fix_ci",
      label: "Fix CI",
      description: "Ask @cursor to repair CI",
      when: (pr, flags) => pr.status === "ci_failed" && flags.work === true,
    },
  ],
  actionContext: {
    work: true,
  },
});
```

## Result Shapes

`ActionablePR` extends `ScannedPR` with:

```typescript
{
  actions: readonly PRActionDescriptor[];
}
```

`PRInbox` contains:

- `all`
- `readyForHuman`
- `needsBotBump`
- `inProgress`
- `blocked`

Each bucket contains `ActionablePR` items.

## Low-Level Helpers

The package still exports the smaller building blocks when you want them:

- `analyzePR(client, owner, repo, prOrNumber, botMention, hooks?)`
- `analyzeAll(prs, client, botMention, logger?, hooks?)`
- `scanSinglePR(client, botMention, owner, repo, prNumber, hooks?)`
- `classifyPRs(prs, config?)`
- `getAvailableActions(pr, extraActions?, actionContext?)`

Use these when you need to plug the analyzer into an existing flow. Use `createPRAnalyzer()` when you want the cleanest client code.
