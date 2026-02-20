# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## Packages

### AI

| Package | Description |
|---------|------------|
| [`ai`](./packages/ai) | AI SDK integration for Anthropic & Ollama with agents, streaming, and structured outputs (JSON, Zod schemas) |

### GitHub / CI

| Package | Description |
|---------|------------|
| [`ci-scripts`](./packages/ci-scripts) | CI automation: lint auto-fix, dependency validation, and topologically sorted publishing |
| [`github`](./packages/github) | GitHub API integration for PR polling, activity, and event-driven repo monitoring atop Octokit |
| [`pr-analyzer`](./packages/pr-analyzer) | PR analysis pipeline: CI/review/conflict aggregation, action classification, and merge readiness |
| [`repo-processor`](./packages/repo-processor) | Incremental GitHub repo processor with SHA-based stale detection and YAML-backed persistence |

### Async / Control Flow

| Package | Description |
|---------|------------|
| [`daemon`](./packages/daemon) | Graceful daemon utilities with LIFO teardown, interruptible loops, and error resilience |
| [`poller`](./packages/poller) | Configurable polling with debounce, structural change detection, and lifecycle management |
| [`throttle`](./packages/throttle) | Token bucket rate limiting, exponential backoff, and throttled batch updates |
| [`workflow-engine`](./packages/workflow-engine) | Typed workflow engine with state machines, persistence, gates, and retry hooks |
| [`queue`](./packages/queue) | High-performance priority queue with O(1) ops, FIFO within priority, and dynamic reordering |

### Messaging

| Package | Description |
|---------|------------|
| [`chat`](./packages/chat) | Cross-platform chat bot framework (Discord/Slack) with commands, batching, and reactions |
| [`websocket`](./packages/websocket) | WebSocket client with auto-reconnect, token refresh, and heartbeat-driven health checks |
| [`worker-server`](./packages/worker-server) | WebSocket-based RPC server for remote worker coordination and load balancing |

### Data / State

| Package | Description |
|---------|------------|
| [`collections`](./packages/collections) | Low-level array chunking and depth-based filesystem traversal utilities |
| [`date-time`](./packages/date-time) | Strongly-typed `TimeSpan` handling with unit-aware millisecond conversion |
| [`state-tracker`](./packages/state-tracker) | Atomic JSON state persistence with migrations, debounce, and fallback to in-memory |
| [`usage-tracker`](./packages/usage-tracker) | Usage & cost tracking with session/cumulative metrics, time-windowed limits, and persistence |

### Utilities

| Package | Description |
|---------|------------|
| [`document-generator`](./packages/document-generator) | Fluent document composition for Markdown, Slack mrkdwn, and plain text output |
| [`http`](./packages/http) | Secure HTTP utilities: constant-time comparison, body size limits, CORS |
| [`logger`](./packages/logger) | Plugin-based structured logging (console, file, Discord) with per-plugin level filtering |
| [`rest-client`](./packages/rest-client) | Typed REST client with Zod validation, OAuth2/bearer/custom auth, and retry logic |
| [`task-list`](./packages/task-list) | Unified task-list abstraction for Linear/Trello with async factory pattern |
| [`text`](./packages/text) | Text processing for YAML/JSON conversion, tree building, sanitization, and formatting |
| [`ts-config`](./packages/ts-config) | Shareable TypeScript, ESLint (flat), and Prettier configs |

### Tooling

| Package | Description |
|---------|------------|
| [`shared-config`](./packages/shared-config) | Auto-synced shared configs (TypeScript/ESLint/Prettier) with strict compiler settings |

## GitHub Actions Setup

To enable full CI automation (lint fixes, auto-commits, publishing), configure these repository secrets:

- `NPM_TOKEN`: GitHub package registry token for publishing packages
- `PAT_TOKEN`: Personal access token with `repo` scope for committing lint fixes and tagging releases

These enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.