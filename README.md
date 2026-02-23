# TypeScript Monorepo

A collection of focused, opinionated, easy-to-use npm packages for building robust TypeScript applications.

## Packages

### AI & Agent Tools

| Package | Description |
|---------|-----|
| [ai](./packages/ai) | Core AI/LLM integration: unified client abstraction (Anthropic/Ollama), agent orchestration, streaming, and multimodal messages. |
| [agent-tools](./packages/agent-tools) | Agent utilities: config-driven I/O limits, path parsing with line ranges, error/result helpers. |

### GitHub / CI

| Package | Description |
|---------|-----|
| [github](./packages/github) | GitHub PR monitoring: polling, state snapshots, timeline building, and event-driven watching. |
| [ci-scripts](./packages/ci-scripts) | CI/CD automation: auto-fix commits, pinned dependency validation, topological publishing. |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis: CI status, reviews, conflicts, bot mentions → action buckets & available actions. |
| [repo-processor](./packages/repo-processor) | Incremental repo processing: SHA-based change detection, parallel traversal, git-backed state. |

### Async & Control Flow

| Package | Description |
|---------|-----|
| [poller](./packages/poller) | Generic polling utility with debouncing, pending-state dedup, and equality-based change detection. |
| [queue](./packages/queue) | High-performance priority queue with O(1) ops, FIFO within buckets, and dynamic priority updates. |
| [throttle](./packages/throttle) | Rate limiting + retries: token bucket, exponential backoff, transient error detection, event wrapping. |
| [worker-server](./packages/worker-server) | WebSocket worker server: connection management, health checks, dynamic routing, per-category concurrency. |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine: state machines with validated transitions, persistence, gates, retry, lifecycle hooks. |

### Messaging & UI

| Package | Description |
|---------|-----|
| [chat](./packages/chat) | Cross-platform chat abstraction: Discord/Slack, unified APIs for messaging, threads, commands, streaming. |
| [websocket](./packages/websocket) | High-fidelity WebSocket client: exponential reconnection, proactive token refresh, heartbeat health checks. |
| [storybook-components](./packages/storybook-components) | React components for Storybook: primitives (Button, Text, etc.) + composites (ActivityFeed, StatCard, etc.). |

### Data & State

| Package | Description |
|---------|-----|
| [state-tracker](./packages/state-tracker) | Robust state persistence: atomic writes, schema migrations, debounced save, fallback to in-memory. |
| [usage-tracker](./packages/usage-tracker) | Usage & cost tracking: session metrics, cumulative spend, time-windowed limits, session-aware persistence. |
| [collections](./packages/collections) | Array chunking & filesystem path depth grouping for bottom-up directory processing. |
| [task-list](./packages/task-list) | Provider-agnostic task list management: Trello/Linear abstraction, polling watcher, shared models. |

### Utilities

| Package | Description |
|---------|-----|
| [text](./packages/text) | Text utilities: chunking, formatting, YAML/JSON conversion, markdown escaping, templating, slugification. |
| [date-time](./packages/date-time) | Strongly-typed TimeSpan utility with millisecond conversion and configurable TimeUnit enum. |
| [http](./packages/http) | Safe HTTP handling: configurable body size limits, JSON with CORS, safe cookie parsing. |
| [logger](./packages/logger) | Structured logging: pluggable output (console/file/Discord), per-plugin filtering, JSONL session tracking. |
| [daemon](./packages/daemon) | Node.js daemon process utilities. |
| [rest-client](./packages/rest-client) | Typed REST client: declarative ops, OAuth2/Zod validation, retry, structured errors (built on Axios). |
| [document-generator](./packages/document-generator) | Fluent document generation: headers/lists/links → Markdown/Slack mrkdwn/plain text with platform-aware formatting. |

### Tooling

| Package | Description |
|---------|-----|
| [shared-config](./packages/shared-config) | Centralized config: TypeScript, postinstall sync, npm scripts for build/lint. |
| [ts-config](./packages/ts-config) | Unified TypeScript/ESLint/Prettier config for consistent tooling across projects (incl. Next). |

## GitHub Actions Setup

To enable full CI/CD automation (e.g., publishing, auto-fix commits), configure these repository secrets:

- `NPM_TOKEN`: npm authentication token for publishing packages  
- `PAT_TOKEN`: GitHub Personal Access Token for CI auto-fix commits and repo operations (with `repo` scope)

These secrets enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.