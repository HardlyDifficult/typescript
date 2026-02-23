# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## Packages

### AI & LLMs

| Package | Description |
|---------|-----------|
| [`ai`](./packages/ai) | Unified AI/LLM client and agent orchestration (Anthropic/Ollama), tool-calling, streaming, caching, and multimodal message handling |
| [`agent-tools`](./packages/agent-tools) | Core agent tooling: config-driven I/O limits, GitHub-style path parsing, and error/result helpers |

### GitHub & CI/CD

| Package | Description |
|---------|-----------|
| [`ci-scripts`](./packages/ci-scripts) | CI/CD automation: auto-fix commits, pinned dep validation, and topologically resolved publishing with git tagging |
| [`github`](./packages/github) | GitHub PR monitoring: polling-based change detection, state snapshots, timeline building, and event-driven watching |
| [`pr-analyzer`](./packages/pr-analyzer) | PR analysis pipeline: CI/review/conflict detection, action classification (ready/blocked), and merge automation suggestions |
| [`repo-processor`](./packages/repo-processor) | Incremental repo processor: SHA-based change detection, parallel traversal, and git-backed YAML state persistence |

### Async & Control Flow

| Package | Description |
|---------|-----------|
| [`poller`](./packages/poller) | Generic polling utility with debouncing, concurrent fetch skipping, and shallow/deep change detection |
| [`queue`](./packages/queue) | High-performance priority queue (O(1) ops) with FIFO within priority and dynamic priority updates |
| [`throttle`](./packages/throttle) | Rate limiting & retries: token-bucket throttling, exponential backoff, network error detection, and promise wrapping |
| [`worker-server`](./packages/worker-server) | WebSocket-based server for managing live workers with heartbeat checks and category-specific concurrency controls |
| [`daemon`](./packages/daemon) | Daemon utilities for Node |

### Messaging & HTTP

| Package | Description |
|---------|-----------|
| [`chat`](./packages/chat) | Cross-platform chat abstraction (Discord/Slack) for messaging, threads, commands, streaming, and batch operations |
| [`http`](./packages/http) | Safe HTTP utilities: configurable body size limits, JSON/CORS responses, and safe cookie handling |
| [`websocket`](./packages/websocket) | High-fidelity WebSocket client with exponential backoff reconnection, proactive token refresh, and heartbeat health checks |
| [`rest-client`](./packages/rest-client) | Typed REST client with Zod validation, retry logic, OAuth2/bearer auth, and structured error handling (built atop Axios) |

### Data & State

| Package | Description |
|---------|-----------|
| [`state-tracker`](./packages/state-tracker) | State persistence engine with atomic JSON writes, schema migrations, debounced auto-save, and fallback to in-memory |
| [`usage-tracker`](./packages/usage-tracker) | Usage tracking with session/cumulative metrics, USD cost monitoring, and time-windowed spend limits |
| [`collections`](./packages/collections) | Array chunking and filesystem path depth grouping optimized for bottom-up directory processing |
| [`text`](./packages/text) | Text utilities: chunking, YAML/JSON conversion, markdown escaping, templating, slugification, and linkification |
| [`date-time`](./packages/date-time) | Strongly-typed TimeSpan utility with unit-aware multipliers and configurable TimeUnit enum |

### Utilities & Tooling

| Package | Description |
|---------|-----------|
| [`document-generator`](./packages/document-generator) | Structured doc generation with fluent API for headers/lists/links, supporting Markdown, Slack mrkdwn, and plain text |
| [`logger`](./packages/logger) | Pluggable structured logging with console/file/Discord plugins, per-plugin filtering, JSONL session tracking |
| [`task-list`](./packages/task-list) | Unified task abstraction for Trello/Linear with abstract client, shared models, and polling TaskWatcher |
| [`shared-config`](./packages/shared-config) | Centralized config: TypeScript, postinstall sync, and npm scripts for build/linting |
| [`ts-config`](./packages/ts-config) | Shared TypeScript/ESLint/Prettier configs (flat configs for base + Next.js) |
| [`storybook-components`](./packages/storybook-components) | React + Storybook component library with Tailwind, TypeScript, and headless visual regression testing |

## GitHub Actions Setup

Required repository secrets:

- `NPM_TOKEN`: For automated npm publishing (package versioning and tag creation)
- `PAT_TOKEN`: For GitHub API access (PR monitoring, auto-fix commits, and CI integration)

See individual package READMEs for usage details.