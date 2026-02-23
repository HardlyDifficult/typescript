# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## AI

| Package | Description |
|---------|-----|
| [ai](./packages/ai) | Unified AI/LLM integration with Anthropic, Ollama, tool-calling, streaming, caching, and multimodal messaging |
| [agent-tools](./packages/agent-tools) | Core utilities for safe, config-driven agent execution with path parsing, I/O limits, and error formatting |

## GitHub / CI

| Package | Description |
|---------|-----|
| [ci-scripts](./packages/ci-scripts) | CI/CD automation: auto-fix commits, dependency validation, topological publishing with npm versioning |
| [github](./packages/github) | GitHub PR monitoring with polling, branch/PR state snapshots, timeline building, and event-driven watching |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis pipeline for status, reviews, conflicts, and classification into action buckets (ready/blocked/needs-bump) |
| [repo-processor](./packages/repo-processor) | Incremental GitHub repo processor with SHA-based change detection and git-backed YAML state persistence |

## Async / Control Flow

| Package | Description |
|---------|-----|
| [poller](./packages/poller) | Generic polling utility with debouncing, pending-state deduplication, and shallow/deep change detection |
| [queue](./packages/queue) | High-performance priority queue with O(1) ops, FIFO within priority, and dynamic updates via observer pattern |
| [throttle](./packages/throttle) | Token-bucket rate limiting with persistence, exponential backoff, and transient error detection |
| [worker-server](./packages/worker-server) | WebSocket-based worker server with heartbeat monitoring and category-specific concurrency controls |

## Messaging

| Package | Description |
|---------|-----|
| [chat](./packages/chat) | Cross-platform chat abstraction for Discord/Slack with unified messaging, threads, commands, and streaming |
| [websocket](./packages/websocket) | High-fidelity WebSocket client with exponential reconnection, token refresh, and heartbeat health checks |

## Data / State

| Package | Description |
|---------|-----|
| [state-tracker](./packages/state-tracker) | Robust state persistence with atomic writes, schema migrations, and in-memory fallback |
| [usage-tracker](./packages/usage-tracker) | Session/cumulative usage tracking with USD cost monitoring and time-windowed spend limits |
| [collections](./packages/collections) | Array chunking and filesystem path depth grouping for bottom-up directory processing |

## Utilities

| Package | Description |
|---------|-----|
| [date-time](./packages/date-time) | Strongly-typed TimeSpan utility with unit-aware multipliers and configurable TimeUnit enum |
| [daemon](./packages/daemon) | Daemon process utilities for Node |
| [document-generator](./packages/document-generator) | Fluent document generator for Markdown, Slack mrkdwn, and plain text with platform-aware formatting |
| [http](./packages/http) | Safe HTTP utilities with body size limits, JSON/CORS helpers, and header parsing |
| [logger](./packages/logger) | Pluggable structured logging with console/file/Discord output, per-plugin filtering, and JSONL session tracking |
| [rest-client](./packages/rest-client) | Typed REST client with Zod validation, retry logic, and OAuth2/bearer/custom auth support |
| [text](./packages/text) | Text utilities for chunking, YAML/JSON conversion, escaping, templating, slugification, and linkification |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine with validated state transitions, persistence, gate pausing, and retry logic |

## Tooling

| Package | Description |
|---------|-----|
| [shared-config](./packages/shared-config) | Centralized config for the repo with auto-synced postinstall and npm scripts |
| [task-list](./packages/task-list) | Provider-agnostic task list abstraction for Trello/Linear with polling `TaskWatcher` |
| [storybook-components](./packages/storybook-components) | Tailwind + React UI library with tokenized primitives and composite widgets |
| [ts-config](./packages/ts-config) | Shared TypeScript/ESLint/Prettier config for consistent tooling (including Next.js support) |

## GitHub Actions Setup

To enable full CI/CD automation (e.g., publishing, auto-fix commits), configure these repository secrets:

- `NPM_TOKEN`: npm authentication token for publishing packages  
- `PAT_TOKEN`: GitHub Personal Access Token for CI auto-fix commits and repo operations (with `repo` scope)

These secrets enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.