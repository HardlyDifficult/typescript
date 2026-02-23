# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## Packages

### AI & LLMs

| Package | Description |
|---------|-----------|
| [ai](./packages/ai) | Unified AI/LLM integration: client factory, agent orchestration, streaming, and structured outputs |
| [agent-tools](./packages/agent-tools) | Core agent tooling: config-driven I/O limits, GitHub-style path parsing, and safe result formatting |

### GitHub / CI

| Package | Description |
|---------|-----------|
| [github](./packages/github) | GitHub PR monitoring: polling, change detection, event emission, and high-level clients |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis pipeline: CI/review/conflict scanning, action classification, merge-readiness |
| [repo-processor](./packages/repo-processor) | Incremental GitHub repo processor: SHA detection, parallel file/dir processing, YAML state persistence |
| [ci-scripts](./packages/ci-scripts) | CI automation: semantic versioning, dependency resolution, auto-versioning, and lint/format fixes |

### Async & Control Flow

| Package | Description |
|---------|-----------|
| [poller](./packages/poller) | Debounced polling utility with concurrent fetch skipping and JSON-based change detection |
| [queue](./packages/queue) | High-performance priority queue with O(1) ops and observer pattern support |
| [throttle](./packages/throttle) | Rate-limiting and retry logic: token bucket, exponential backoff, and retry helpers |
| [worker-server](./packages/worker-server) | WebSocket-based worker server with health checks and category-specific concurrency |
| [daemon](./packages/daemon) | Daemon utilities for Node |

### Messaging & Social

| Package | Description |
|---------|-----------|
| [chat](./packages/chat) | Chat abstraction for Discord/Slack: platform-agnostic messaging, commands, batching, streaming |
| [social](./packages/social) | Social media abstraction with X/Twitter and Mastodon clients; polling-based like watcher |
| [websocket](./packages/websocket) | Robust WebSocket client: auto-reconnect, JWT refresh, request tracking, and draining |

### Data & State

| Package | Description |
|---------|-----------|
| [state-tracker](./packages/state-tracker) | State persistence engine with atomic writes, schema migrations, and fallback to in-memory mode |
| [collections](./packages/collections) | Low-level utilities: array chunking, directory-depth grouping for bottom-up processing |
| [date-time](./packages/date-time) | Strongly-typed `TimeSpan` and `toMilliseconds` utilities for precise duration handling |
| [text](./packages/text) | Structured text processing: YAML/JSON conversion, healing, chunking, slugification, linkification |
| [usage-tracker](./packages/usage-tracker) | Usage & spend tracking: session/cumulative metrics, USD cost estimation, limit enforcement |

### UI & Tooling

| Package | Description |
|---------|-----------|
| [document-generator](./packages/document-generator) | Platform-aware doc generator: chainable blocks, multi-format output (Markdown, mrkdwn, text) |
| [rest-client](./packages/rest-client) | Typed REST client with Zod validation, OAuth2/auth, retries, and structured error handling |
| [http](./packages/http) | HTTP utilities: body size limiting, constant-time string comparison |
| [logger](./packages/logger) | Structured logging: pluggable channels, session-based JSONL, plugin-level filtering |
| [task-list](./packages/task-list) | Task list management: Linear/Trello abstraction, deferred APIs, polling TaskWatcher |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine: state machine (with hooks) and sequential pipeline orchestration |
| [storybook-components](./packages/storybook-components) | React component library with atomic primitives and domain-specific widgets |
| [ts-config](./packages/ts-config) | Centralized TypeScript/ESLint/Next.js configuration |
| [shared-config](./packages/shared-config) | Monorepo-wide config: root name and postinstall script for config sync |

## GitHub Actions Setup

This monorepo uses automated CI/CD via GitHub Actions. Required repository secrets:

- `NPM_TOKEN`: For publishing packages to npm
- `PAT_TOKEN`: For auto-fix commits, git tagging, and CI automation (requires `repo` scope)

See individual package READMEs for usage details.

## Contributor: Runtime & Package Metadata Policy

To keep package behavior and CI predictable across the monorepo:

- **Node.js baseline:** all workspace packages under `packages/*` must declare `"engines": { "node": ">=20.19.0" }`.
- **Required package metadata:** each package `package.json` must include `name`, `version`, `files`, `scripts`, and `engines`.
- **Required scripts:** each package must define `build` and `clean` scripts.

Validation is enforced by CI via:

```bash
node packages/ci-scripts/dist/check-package-metadata.js
```

You can run the same check locally with:

```bash
npm run validate:packages
```
