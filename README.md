# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## AI

| Package | Description |
|---------|-----------|
| [ai](./packages/ai) | Core AI SDK with unified client factory, agent orchestration, structured output extraction, and usage tracking |
| [chat](./packages/chat) | Platform-agnostic chat bot framework for Discord/Slack with streaming, batching, and threading support |

## GitHub / CI

| Package | Description |
|---------|-----------|
| [ci-scripts](./packages/ci-scripts) | CI automation utilities: auto-fix commits, version resolution, and topologically sorted publishing |
| [github](./packages/github) | GitHub integration for PR monitoring, polling, and timeline analysis atop Octokit |
| [pr-analyzer](./packages/pr-analyzer) | Pull request analysis pipeline: aggregates CI/reviews/conflicts, classifies status, and suggests actions |
| [repo-processor](./packages/repo-processor) | Incremental GitHub repo processor with SHA-based stale detection and atomic YAML persistence |

## Async / Control Flow

| Package | Description |
|---------|-----------|
| [poller](./packages/poller) | Robust polling utility with change detection, debounced triggers, and lifecycle management |
| [queue](./packages/queue) | High-performance priority queue with O(1) ops and dynamic priority manipulation |
| [throttle](./packages/throttle) | Rate-limiting (token bucket), exponential backoff, and throttled batch updates for async workloads |
| [worker-server](./packages/worker-server) | WebSocket-based RPC server for distributed workers with health monitoring and load balancing |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine with state machines, data cursors, and lifecycle hooks |

## Messaging

| Package | Description |
|---------|-----------|
| [websocket](./packages/websocket) | Resilient WebSocket client with reconnection, heartbeat detection, and request tracking |

## Data / State

| Package | Description |
|---------|-----------|
| [collections](./packages/collections) | Array/path utilities for batched parallel processing (e.g., `chunk`, `groupByDepth`) |
| [state-tracker](./packages/state-tracker) | Atomic JSON persistence with debouncing, fallback to memory, and key sanitization |
| [usage-tracker](./packages/usage-tracker) | Usage tracking with session/cumulative metrics, cost monitoring, and persisted state |

## Utilities

| Package | Description |
|---------|-----------|
| [date-time](./packages/date-time) | Strongly-typed `TimeSpan` and millisecond conversion utilities for 5 time units |
| [document-generator](./packages/document-generator) | Fluent document generation to Markdown, Slack mrkdwn, and plain text |
| [http](./packages/http) | Secure HTTP utilities: timing-safe comparisons, bounded bodies, JSON + CORS |
| [logger](./packages/logger) | Plugin-based structured logging with console/file/Discord handlers |
| [teardown](./packages/teardown) | Idempotent resource cleanup with signal trapping and LIFO execution order |
| [text](./packages/text) | Text utilities: chunking, formatting, YAML/JSON conversion, linkification |

## Tooling

| Package | Description |
|---------|-----------|
| [shared-config](./packages/shared-config) | Auto-synced shared configs: TypeScript, ESLint, and Prettier for consistency |
| [ts-config](./packages/ts-config) | Shareable TypeScript/ESLint/Prettier configs (flat config, Next.js ready) |

## GitHub Actions Setup

To enable full automation in this monorepo, ensure the following secrets are configured:

- `NPM_TOKEN` — Required for publishing packages to npm (set as a repository secret in GitHub)  
- `PAT_TOKEN` — Required for auto-fixing lint issues and tagging releases in CI (must be a GitHub Personal Access Token with `repo` scope)

These enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.
