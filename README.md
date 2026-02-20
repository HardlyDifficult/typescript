# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust TypeScript applications — from AI integrations to workflow automation.

## AI

| Package | Description |
|---------|------------|
| [`ai`](./packages/ai) | Core AI SDK with unified client factory, agent orchestration, structured output extraction, and usage tracking. |

## GitHub & CI

| Package | Description |
|---------|------------|
| [`ci-scripts`](./packages/ci-scripts) | CI automation: auto-fix commits, pinned deps validation, topological publishing, git tagging. |
| [`github`](./packages/github) | GitHub REST API client for PR/repo monitoring with state snapshotting and diff tracking. |
| [`pr-analyzer`](./packages/pr-analyzer) | PR analysis pipeline: aggregates CI/reviews/conflicts, classifies status, suggests actions. |
| [`repo-processor`](./packages/repo-processor) | Incremental GitHub repo processor with tree diffs, parallel file processing, and state persistence. |

## Async & Control Flow

| Package | Description |
|---------|------------|
| [`poller`](./packages/poller) | Generic polling utility with deep-equality change detection and debounced triggers. |
| [`queue`](./packages/queue) | High-performance priority queue with O(1) operations and dynamic reordering. |
| [`throttle`](./packages/throttle) | Rate-limiting with exponential backoff and connection error detection. |
| [`websocket`](./packages/websocket) | Resilient WebSocket client with reconnection, heartbeat detection, and graceful shutdown. |
| [`worker-server`](./packages/worker-server) | WebSocket-based RPC server for distributed workers with health monitoring and load balancing. |
| [`workflow-engine`](./packages/workflow-engine) | Typed workflow engine with state machines, cursors, pipeline abstractions, and retry logic. |
| [`teardown`](./packages/teardown) | Idempotent resource cleanup with signal trapping, LIFO execution order, and error-resilient registration. |

## Messaging

| Package | Description |
|---------|------------|
| [`chat`](./packages/chat) | Platform-agnostic chat bot with Discord/Slack support, batching, threading, and streaming. |
| [`document-generator`](./packages/document-generator) | Fluent document generation for Markdown, Slack mrkdwn, and plain text with platform-aware formatting. |

## Data & State

| Package | Description |
|---------|------------|
| [`collections`](./packages/collections) | Low-level utilities for array chunking and hierarchical path grouping. |
| [`state-tracker`](./packages/state-tracker) | Robust state persistence with atomic writes and automatic fallback to in-memory mode. |
| [`usage-tracker`](./packages/usage-tracker) | Usage and cost tracking with session/cumulative metrics and persisted state. |

## Utilities

| Package | Description |
|---------|------------|
| [`date-time`](./packages/date-time) | Strongly-typed `TimeSpan` utility with millisecond conversion and precise duration handling across units. |
| [`http`](./packages/http) | HTTP utilities with constant-time comparison, bounded body reading, and CORS JSON responses. |
| [`logger`](./packages/logger) | Plugin-based structured logging with severity filtering, multiple outputs (console/file/Discord). |
| [`text`](./packages/text) | Text processing: chunking, formatting, linkification, YAML/JSON conversion, and error handling. |
| [`task-list`](./packages/task-list) | Provider-agnostic task-list abstraction (Trello/Linear) with unified data resolution and chaining. |

## Tooling

| Package | Description |
|---------|------------|
| [`shared-config`](./packages/shared-config) | Shared configs (TypeScript, ESLint, Prettier) auto-synced to repo root — ensures consistency across packages. |
| [`ts-config`](./packages/ts-config) | Shareable TypeScript, ESLint (flat config), and Prettier configs for tooling consistency. |

## GitHub Actions Setup

To enable full automation in this monorepo, ensure the following secrets are configured:

- `NPM_TOKEN` – Required for publishing packages to npm (set as a repository secret in GitHub)  
- `PAT_TOKEN` – Required for auto-fixing lint issues and tagging releases in CI (must be a GitHub Personal Access Token with `repo` scope)

These enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.