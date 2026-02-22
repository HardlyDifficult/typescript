# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## AI & LLMs

| Package | Description |
|---------|-------------|
| [ai](./packages/ai) | Unified LLM client (Anthropic/Ollama) with agent orchestration, streaming, caching, and multimodal message handling |
| [agent-tools](./packages/agent-tools) | Core utilities for safe, predictable agent execution: I/O limits, path parsing, and result formatting |

## GitHub & CI

| Package | Description |
|---------|-------------|
| [github](./packages/github) | PR monitoring: polling, activity fetching, change detection, and high-level GitHub clients |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis pipeline: CI status, reviews, conflicts, bot mentions, and actionable classification |
| [ci-scripts](./packages/ci-scripts) | CI automation for versioning, tagging, lint/format auto-fixes, and dependency pinning validation |
| [repo-processor](./packages/repo-processor) | Incremental GitHub repo processor with SHA-based stale detection and YAML persistence |

## Async & Control Flow

| Package | Description |
|---------|-------------|
| [queue](./packages/queue) | High-performance priority queue with O(1) ops, FIFO within priorities, and observer-driven updates |
| [poller](./packages/poller) | Generic polling with debouncing, overlapping request suppression, and change detection via equality checks |
| [throttle](./packages/throttle) | Rate-limiting with token-bucket, exponential backoff, transient error detection, and persistence |
| [daemon](./packages/daemon) | Robust daemon utilities: signal-handled teardown, interruptible loops with dynamic delays |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine with state machines, cursors, persistence, gate pausing, and lifecycle hooks |

## Messaging & Servers

| Package | Description |
|---------|-------------|
| [chat](./packages/chat) | Cross-platform chat abstraction (Discord/Slack) with unified APIs for messaging, threads, commands, and streaming |
| [websocket](./packages/websocket) | Robust WebSocket client with exponential reconnection, token refresh, and heartbeat health checks |
| [worker-server](./packages/worker-server) | WebSocket-based worker server with health checks, dynamic routing, and category-specific concurrency |

## Data & State

| Package | Description |
|---------|-------------|
| [state-tracker](./packages/state-tracker) | Robust state persistence with atomic writes, schema migrations, and auto-save with fallback mode |
| [usage-tracker](./packages/usage-tracker) | Usage and cost tracking: session/cumulative metrics, USD spend limits, and cross-session persistence |

## Utilities

| Package | Description |
|---------|-------------|
| [collections](./packages/collections) | Array chunking and path depth grouping for bottom-up directory processing |
| [date-time](./packages/date-time) | Typed TimeSpan with unit-aware multipliers and configurable TimeUnit enum |
| [text](./packages/text) | Text utilities: chunking, YAML/JSON, markdown escaping, templating, slugification, and linkification |
| [http](./packages/http) | Safe HTTP utilities: body size limits, CORS-enabled JSON responses, and secure cookie parsing |
| [logger](./packages/logger) | Structured logging with pluggable outputs (console/file/Discord), per-plugin filtering, and JSONL sessions |
| [rest-client](./packages/rest-client) | Typed REST client with Zod validation, retry logic, OAuth2/bearer auth, and structured errors |
| [task-list](./packages/task-list) | Abstract task management (Trello/Linear) with unified CRUD, deferred APIs, and task watching |
| [shared-config](./packages/shared-config) | Centralized config with auto-synced files and npm scripts for build/linting |
| [ts-config](./packages/ts-config) | Shared TypeScript, ESLint, and Prettier configs (including Next.js support) |
| [document-generator](./packages/document-generator) | Fluent document generator for Markdown, Slack mrkdwn, and plain text with platform-aware formatting |

## GitHub Actions Setup

To enable full CI/CD automation (e.g., publishing, auto-fix commits), configure these repository secrets:

- `NPM_TOKEN`: npm authentication token for publishing packages  
- `PAT_TOKEN`: GitHub Personal Access Token for CI auto-fix commits and repo operations (with `repo` scope)

These secrets enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.