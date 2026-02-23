# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## Packages

### AI & LLMs

| Package | Description |
|---------|-------------|
| [ai](./packages/ai) | Unified AI/LLM client abstraction (Anthropic/Ollama) with tool-calling, streaming, caching, and multimodal message handling |
| [agent-tools](./packages/agent-tools) | Core agent tooling: config-driven I/O limits, GitHub-style path parsing, and error/result helpers |

### GitHub & CI/CD

| Package | Description |
|---------|-------------|
| [ci-scripts](./packages/ci-scripts) | Monorepo automation: auto-fix commits, pinned dep validation, topologically resolved publishing with git tagging |
| [github](./packages/github) | GitHub polling, PR monitoring, branch/PR activity detection, and Octokit-based event watching |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis pipeline: status, reviews, conflicts, bot mentions → classification & action availability |
| [repo-processor](./packages/repo-processor) | Incremental GitHub repo processor: SHA-based change detection, parallel file traversal, git-backed YAML state |

### Async & Control Flow

| Package | Description |
|---------|-------------|
| [poller](./packages/poller) | Generic polling utility: debounced triggers, concurrent skip tracking, shallow/deep equality change detection |
| [queue](./packages/queue) | High-performance priority queue: O(1) ops, FIFO within buckets, dynamic priority updates via observers |
| [throttle](./packages/throttle) | Rate limiting: token-bucket with persistence, exponential backoff, transient error detection, retry wrapping |
| [daemon](./packages/daemon) | Node daemon utilities for background process management |
| [worker-server](./packages/worker-server) | WebSocket worker server with health checks, heartbeat monitoring, and category-specific concurrency |

### Messaging & UI

| Package | Description |
|---------|-------------|
| [chat](./packages/chat) | Cross-platform chat abstraction (Discord/Slack): unified APIs for messaging, threads, commands, streaming |
| [websocket](./packages/websocket) | WebSocket client with exponential backoff, token refresh, request tracking, and heartbeat health checks |
| [storybook-components](./packages/storybook-components) | React UI components with Storybook 10 integration, Tailwind CSS, and ESM/Vite-first tooling |

### Data & State

| Package | Description |
|---------|-------------|
| [state-tracker](./packages/state-tracker) | Robust state persistence: atomic JSON writes, schema migrations, debounced auto-save, fallback mode |
| [collections](./packages/collections) | Array chunking and filesystem path depth grouping for bottom-up directory processing |
| [usage-tracker](./packages/usage-tracker) | Usage & spend tracking: session/cumulative metrics, USD limits, cross-session persistence |

### Utilities & Helpers

| Package | Description |
|---------|-------------|
| [http](./packages/http) | Safe HTTP utilities: body size limits, CORS JSON responses, client error handling |
| [text](./packages/text) | Text processing: chunking, markdown escaping, YAML/JSON conversion, templating, linkification |
| [date-time](./packages/date-time) | Strongly-typed TimeSpan with unit-aware multipliers and configurable TimeUnit enum |
| [document-generator](./packages/document-generator) | Fluent document builder for Markdown, Slack mrkdwn, and plain text with platform-aware formatting |
| [logger](./packages/logger) | Structured logging with pluggable outputs (console/file/Discord), per-plugin filtering, JSONL session tracking |
| [rest-client](./packages/rest-client) | Typed REST client: Zod validation, OAuth2/bearer auth, retry logic, Axios-based |

### Tooling & Config

| Package | Description |
|---------|-------------|
| [shared-config](./packages/shared-config) | Centralized config: TypeScript, npm scripts, and postinstall auto-sync of config files |
| [ts-config](./packages/ts-config) | Shared TypeScript/ESLint/Prettier configs with flat ESLint configs (base + Next.js) |
| [task-list](./packages/task-list) | Provider-agnostic task list abstraction (Trello/Linear) with polling TaskWatcher |

## GitHub Actions Setup

This monorepo uses automated CI/CD via GitHub Actions. Required repository secrets:

- `NPM_TOKEN`: For publishing packages to npm
- `PAT_TOKEN`: For auto-fix commits, git tagging, and CI automation (requires `repo` scope)

See individual package READMEs for usage details.