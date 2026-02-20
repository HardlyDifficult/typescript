# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## Packages

### AI

| Package | Description |
|---------|-------------|
| [ai](./packages/ai) | AI SDK integration for Anthropic/Ollama with agent creation, streaming, structured outputs, and multimodal support |

### GitHub / CI

| Package | Description |
|---------|-------------|
| [ci-scripts](./packages/ci-scripts) | CI automation for linting fixes, dep validation, and topologically sorted publishing |
| [github](./packages/github) | GitHub API clients for PR/repo operations with polling, change detection, and event emission |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis pipeline: aggregates CI/reviews/conflicts, classifies status, suggests actions |
| [repo-processor](./packages/repo-processor) | Incremental GitHub repo processor with SHA-based stale detection and YAML persistence |

### Async / Control Flow

| Package | Description |
|---------|-------------|
| [daemon](./packages/daemon) | Robust daemon utilities: signal-handled teardown, interruptible loops with dynamic delays |
| [poller](./packages/poller) | Configurable polling with debounce, structural change detection, and lifecycle management |
| [queue](./packages/queue) | High-performance priority queue with O(1) ops, FIFO within levels, and dynamic reordering |
| [throttle](./packages/throttle) | Token-bucket rate limiting, exponential backoff, and throttled batch updates with persistence |
| [worker-server](./packages/worker-server) | WebSocket-based worker server with health checks, routing, and per-category concurrency |

### Messaging

| Package | Description |
|---------|-------------|
| [chat](./packages/chat) | Platform-agnostic chat bot framework for Discord/Slack with commands, streaming, and batching |
| [websocket](./packages/websocket) | Type-safe WebSocket client with auto-reconnection, token refresh, and heartbeat-driven recovery |

### Data / State

| Package | Description |
|---------|-------------|
| [state-tracker](./packages/state-tracker) | Atomic JSON persistence with migrations, debounce-auto-save, and graceful fallback |
| [usage-tracker](./packages/usage-tracker) | Usage monitoring with session/cumulative metrics, USD cost tracking, and per-window limits |

### Data / Utilities

| Package | Description |
|---------|-------------|
| [collections](./packages/collections) | Low-level utilities: `chunk` for parallel array processing, `groupByDepth` for path traversal |
| [date-time](./packages/date-time) | Strongly-typed time durations with `TimeSpan` and unit-aware millisecond conversion |
| [document-generator](./packages/document-generator) | Fluent document generation for Markdown, Slack mrkdwn, and plain text with platform-aware output |
| [http](./packages/http) | Secure HTTP utilities: constant-time comparison, size-limited bodies, JSON responses with CORS |
| [logger](./packages/logger) | Plugin-based structured logging with severity filtering, JSONL output, and graceful shutdown |
| [rest-client](./packages/rest-client) | Typed REST client with Zod validation, retry logic, OAuth2/bearer auth, and structured errors |
| [shared-config](./packages/shared-config) | Auto-synced shared TS/ESLint/Prettier configs with strict compiler settings |
| [task-list](./packages/task-list) | Cross-platform task-list abstraction with Linear/Trello clients and async factory pattern |
| [text](./packages/text) | Text utilities: tree building, formatting (YAML/JSON), sanitization, and line-number handling |
| [ts-config](./packages/ts-config) | Shareable TS/ESLint (flat)/Prettier configs, including Next.js settings |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine with state machines, data cursors, gates, retries, and lifecycle hooks |

## GitHub Actions Setup

Required repository secrets:

- `NPM_TOKEN`: For npm publishing automation  
- `PAT_TOKEN`: For CI auto-fix commits (with `repo` scope)

These secrets enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.