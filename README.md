# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for AI, chat, CI automation, data structures, and more.

## Packages

| Package | Description |
|---------|-------------|
| [@hardlydifficult/ai](./packages/ai) | Unified AI SDK integration for LLMs (Anthropic Claude, Ollama) with agent orchestration and structured output parsing |
| [@hardlydifficult/chat](./packages/chat) | Platform-agnostic chat abstraction for Discord and Slack with threading, streaming, and batch operations |
| [@hardlydifficult/ci-scripts](./packages/ci-scripts) | CI automation for dependency validation, topological publishing, and auto-lint fixes via PAT-authenticated Git |
| [@hardlydifficult/collections](./packages/collections) | Low-level array and filesystem utilities for batched processing and directory traversal |
| [@hardlydifficult/date-time](./packages/date-time) | Strongly-typed `TimeSpan` duration model with unit-aware conversion and edge-case validation |
| [@hardlydifficult/document-generator](./packages/document-generator) | Fluent document builder rendering to Markdown, Slack mrkdwn, and plain text |
| [@hardlydifficult/github](./packages/github) | Typed GitHub API client for PR monitoring and repo operations using Octokit |
| [@hardlydifficult/logger](./packages/logger) | Plugin-based structured logger (Console, File, Discord) with JSONL, filtering, and async error handling |
| [@hardlydifficult/poller](./packages/poller) | Generic polling utility with deep-equality change detection and lifecycle management |
| [@hardlydifficult/queue](./packages/queue) | High-performance priority queue with O(1) enqueue/dequeue and FIFO ordering per bucket |
| [@hardlydifficult/shared-config](./packages/shared-config) | Shared configs for TypeScript compilation, linting, and postinstall file management |
| [@hardlydifficult/state-tracker](./packages/state-tracker) | Persistent state manager with atomic I/O, debounced auto-save, and legacy version fallback |
| [@hardlydifficult/task-list](./packages/task-list) | Provider-agnostic task-list abstraction (Trello, Linear) with unified data resolution |
| [@hardlydifficult/teardown](./packages/teardown) | Idempotent LIFO resource cleanup with signal trapping and async teardown support |
| [@hardlydifficult/text](./packages/text) | Text manipulation: chunking, formatting, YAML/JSON conversion, and templating |
| [@hardlydifficult/throttle](./packages/throttle) | Token bucket rate limiting with exponential backoff and retry callbacks |
| [@hardlydifficult/usage-tracker](./packages/usage-tracker) | Session-based usage tracking with cumulative aggregation, spend limits, and resume-time estimation |
| [@hardlydifficult/workflow-engine](./packages/workflow-engine) | Stateful workflow engine with typed state machines, linear pipelines, and persistence |

## GitHub Actions Setup

Add an `NPM_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with an [npm automation token](https://www.npmjs.com/settings/~/tokens).  
Add a `PAT_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with a [GitHub PAT](https://github.com/settings/tokens) that has `repo` scope (used by CI auto-fix workflow).