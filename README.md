# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages.

## Packages

| Package | Description |
|---------|-------------|
| [@hardlydifficult/ai](./packages/ai) | Unified AI SDK integration for LLMs (Claude, Ollama) with agent orchestration, streaming, and robust response parsing |
| [@hardlydifficult/chat](./packages/chat) | Platform-agnostic chat abstraction for Discord and Slack with threading, streaming, and batch operations |
| [@hardlydifficult/ci-scripts](./packages/ci-scripts) | CI automation for monorepo dependency validation, topological publishing, and lint-fix auto-committing |
| [@hardlydifficult/collections](./packages/collections) | Low-level array and filesystem utilities for batched parallel processing and path traversal |
| [@hardlydifficult/date-time](./packages/date-time) | Strongly-typed `TimeSpan` duration model with unit-aware conversions and edge-case validation |
| [@hardlydifficult/document-generator](./packages/document-generator) | Fluent API for composing rich text blocks and rendering to Markdown, Slack mrkdwn, and plain text |
| [@hardlydifficult/github](./packages/github) | GitHub API integration for PR monitoring with polling, caching, and incremental tree diffing |
| [@hardlydifficult/logger](./packages/logger) | Plugin-based structured logger with configurable severity, handlers (console, file, Discord), and JSONL output |
| [@hardlydifficult/poller](./packages/poller) | Generic async polling utility with state-change detection via deep equality and lifecycle management |
| [@hardlydifficult/queue](./packages/queue) | High-performance priority queue with O(1) ops via multi-bucket arrays and dynamic priority updates |
| [@hardlydifficult/shared-config](./packages/shared-config) | Shared TS, build, and lint config with strict compiler settings and Dependabot-ready dependencies |
| [@hardlydifficult/state-tracker](./packages/state-tracker) | Persistent state manager with atomic file I/O, versioned JSON, and in-memory fallback |
| [@hardlydifficult/task-list](./packages/task-list) | Provider-agnostic task-list abstraction (Trello, Linear) with unified data resolution and chaining |
| [@hardlydifficult/teardown](./packages/teardown) | Idempotent LIFO resource cleanup with signal trapping (SIGTERM/SIGINT) and async teardown support |
| [@hardlydifficult/text](./packages/text) | Text utilities for chunking, formatting, templating, slug generation, and LLM-repairable YAML/JSON |
| [@hardlydifficult/throttle](./packages/throttle) | Rate limiting with token buckets, exponential backoff, and throttled batch updates for async workloads |
| [@hardlydifficult/usage-tracker](./packages/usage-tracker) | Session-based usage tracking with persistent state, deep cost aggregation, and configurable spend limits |
| [@hardlydifficult/workflow-engine](./packages/workflow-engine) | Stateful workflow engine with typed state machines, pipelines, gates, retries, and persistence via StateTracker |

## GitHub Actions Setup

Add an `NPM_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with an [npm automation token](https://www.npmjs.com/settings/~/tokens).

Add a `PAT_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with a [GitHub PAT](https://github.com/settings/tokens) that has `repo` scope. This enables the CI auto-fix workflow to push commits that trigger re-runs.
