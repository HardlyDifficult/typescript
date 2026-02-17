# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages.

## Packages

| Package | Description |
|---------|-------------|
| [@hardlydifficult/ai](./packages/ai) | Unified AI client with chainable structured output, usage tracking, and response parsing |
| [@hardlydifficult/chat](./packages/chat) | Unified chat API for Discord and Slack |
| [@hardlydifficult/ci-scripts](./packages/ci-scripts) | Reusable CI scripts |
| [@hardlydifficult/collections](./packages/collections) | Array and collection utilities for batched parallel processing |
| [@hardlydifficult/date-time](./packages/date-time) | Date and time utilities |
| [@hardlydifficult/document-generator](./packages/document-generator) | Platform-agnostic document builder |
| [@hardlydifficult/github](./packages/github) | Typed GitHub API client with repo context gathering (Octokit wrapper) |
| [@hardlydifficult/logger](./packages/logger) | Plugin-based structured logger (Console, Discord, File plugins) |
| [@hardlydifficult/poller](./packages/poller) | Generic state-change poller with interval polling |
| [@hardlydifficult/queue](./packages/queue) | Prioritized FIFO queue with high/medium/low priority buckets |
| [@hardlydifficult/shared-config](./packages/shared-config) | Shared config files synced via postinstall |
| [@hardlydifficult/state-tracker](./packages/state-tracker) | File-based state persistence for recovery across restarts |
| [@hardlydifficult/task-list](./packages/task-list) | Provider-agnostic task list management (Trello, Linear) |
| [@hardlydifficult/teardown](./packages/teardown) | Idempotent resource teardown with signal trapping |
| [@hardlydifficult/text](./packages/text) | Error formatting, template replacement, text chunking, slugify |
| [@hardlydifficult/throttle](./packages/throttle) | Rate limiting utilities with optional state persistence |
| [@hardlydifficult/usage-tracker](./packages/usage-tracker) | Numeric metric accumulation with session/cumulative dual-tracking |
| [@hardlydifficult/ts-config](./packages/ts-config) | Shared ESLint, Prettier, and TypeScript config |
| [@hardlydifficult/workflow-engine](./packages/workflow-engine) | State machine with typed statuses, validated transitions, persistence, and `DataCursor` for nested data access. Includes `Pipeline<TData>` for declarative linear workflows with gates, retries, and auto-logging |

## GitHub Actions Setup

Add an `NPM_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with an [npm automation token](https://www.npmjs.com/settings/~/tokens).

Add a `PAT_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with a [GitHub PAT](https://github.com/settings/tokens) that has `repo` scope. This is used by the CI auto-fix workflow to push commits that trigger re-runs.

## Development

```bash
npm install
npm run build
npm run test
```
