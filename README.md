# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust TypeScript applications—especially around AI, GitHub workflows, messaging, and async control flow.

## AI & LLMs

| Package | Description |
|---------|-------------|
| [ai](./packages/ai) | Core AI/LLM integration: unifies Anthropic & Ollama, streaming, caching, structured outputs (Zod), and tool calling. |
| [agent-tools](./packages/agent-tools) | Infrastructure for deterministic tool execution: config-driven I/O limits, GitHub-style path parsing, and robust error handling. |

## GitHub & CI

| Package | Description |
|---------|-------------|
| [github](./packages/github) | GitHub integration: polling-based PR watching, Octokit clients, timeline building, and tree diffing. |
| [ci-scripts](./packages/ci-scripts) | CI automation: dependency validation, auto-fix with Git retry, and topologically sorted publishing. |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis pipeline: fetches CI/reviews/conflicts, classifies into action buckets, and determines merge readiness. |
| [repo-processor](./packages/repo-processor) | Incremental repo processor with SHA-based change detection, parallel file/dir processing, and YAML-persisted state. |

## Async / Control Flow

| Package | Description |
|---------|-------------|
| [poller](./packages/poller) | Generic polling utility with debounced triggers and deep equality change detection (JSON). |
| [throttle](./packages/throttle) | Token-bucket rate limiting with persistence, exponential backoff, and reliable async retry. |
| [queue](./packages/queue) | High-performance priority queue with O(1) ops, dynamic priorities, and observer hooks. |
| [worker-server](./packages/worker-server) | WebSocket-based worker server with health monitoring and load-balanced routing. |
| [websocket](./packages/websocket) | Smart WebSocket client with reconnection, token refresh, lifecycle tracking, and heartbeat health checks. |

## Messaging

| Package | Description |
|---------|-------------|
| [chat](./packages/chat) | Platform-agnostic chat SDK abstracting Discord/Slack: unified abstractions, command routing, batched/streaming replies. |
| [social](./packages/social) | Social media abstraction: X/Twitter implementation, Mastodon stub, polling like watcher, and normalized post types. |

## Data / State

| Package | Description |
|---------|-------------|
| [state-tracker](./packages/state-tracker) | Resilient local state persistence: atomic JSON writes, schema migrations, and in-memory fallback. |
| [usage-tracker](./packages/usage-tracker) | Usage tracking with session/cumulative metrics, USD cost detection, time-windowed limits, and disk persistence. |
| [collections](./packages/collections) | Low-level utilities: `chunk` for array partitioning, `groupByDepth` for directory traversal. |
| [task-list](./packages/task-list) | Unified task-list abstraction for Linear/Trello: rate-limited clients, deferred fluent API, and lifecycle management. |

## Utilities

| Package | Description |
|---------|-------------|
| [date-time](./packages/date-time) | Strongly-typed `TimeSpan` and `toMilliseconds` conversion with unit-aware multipliers and ESM/CJS dual exports. |
| [document-generator](./packages/document-generator) | Platform-agnostic document generator with fluent API for Markdown, Slack mrkdwn, and plain text output. |
| [http](./packages/http) | Secure HTTP utilities: constant-time comparison, bounded body reading (1MB), JSON/CORS responses. |
| [logger](./packages/logger) | Pluggable structured logging with session-based JSONL tracking and extensible output plugins. |
| [text](./packages/text) | Text utilities for chunking, YAML/JSON conversion, markdown escaping, and linkification. |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine with FSM core and pipeline abstraction: gates, retries, hooks, and persistence. |

## Tooling

| Package | Description |
|---------|-------------|
| [shared-config](./packages/shared-config) | Centralized config: package name, postinstall copy script, and strict tsconfig with CommonJS output. |
| [ts-config](./packages/ts-config) | Shared config for TypeScript, ESLint (flat), and Prettier across the monorepo. |
| [rest-client](./packages/rest-client) | Typed REST client with Zod validation, OAuth2/bearer auth, automatic retries, and structured errors (Axios-based). |
| [daemon](./packages/daemon) | Daemon utilities for graceful Node.js shutdowns and lifecycle management. |
| [storybook-components](./packages/storybook-components) | Shared React UI primitives for Storybook: Stack, Text, Button, and more. |

## GitHub Actions Setup

Required repository secrets:

- `NPM_TOKEN`: For npm publishing automation (e.g., via `ci-scripts`).
- `PAT_TOKEN`: For CI auto-fix workflows (e.g., dependency pinning, Git push with retry logic).

> All packages follow strict TypeScript standards with shared config and dual ESM/CJS output where applicable.