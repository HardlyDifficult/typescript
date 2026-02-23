# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## Packages

### AI & LLM Integration
| Package | Description |
|---------|-----|
| [ai](./packages/ai) | Unified AI/LLM client layer with support for Anthropic/Ollama, tool-calling, streaming, and structured outputs. |
| [agent-tools](./packages/agent-tools) | Core utilities for safe agent execution: config-driven I/O limits, GitHub-style path parsing, and result formatting. |

### GitHub & CI/CD
| Package | Description |
|---------|-----|
| [github](./packages/github) | PR monitoring with polling, state snapshots, timeline building, and event-driven watching via Octokit. |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis pipeline: CI status, reviews, conflicts, bot mentions → action buckets & available actions. |
| [ci-scripts](./packages/ci-scripts) | CI/CD automation: auto-fix commits, pinned dep validation, topologically resolved publishing. |
| [repo-processor](./packages/repo-processor) | Incremental GitHub repo processor with SHA-based change detection and git-backed YAML state. |

### Async & Control Flow
| Package | Description |
|---------|-----|
| [poller](./packages/poller) | Generic polling utility with debouncing, skip-pending, and equality-based change detection. |
| [throttle](./packages/throttle) | Token-bucket rate limiting with exponential backoff, retry, and network error detection. |
| [queue](./packages/queue) | High-performance priority queue with O(1) ops, FIFO within levels, and dynamic priority via observers. |
| [daemon](./packages/daemon) | Node.js daemon process utilities with signal-handled teardown and interruptible loops. |
| [worker-server](./packages/worker-server) | WebSocket-based server for managing live workers, health checks, and category-aware concurrency. |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine with state machines, persistence, gates, and retry logic. |

### Messaging & Communication
| Package | Description |
|---------|-----|
| [chat](./packages/chat) | Cross-platform chat abstraction for Discord/Slack with unified APIs, threading, and streaming. |
| [websocket](./packages/websocket) | Robust WebSocket client with reconnection, token refresh, request tracking, and health checks. |

### Data & State
| Package | Description |
|---------|-----|
| [state-tracker](./packages/state-tracker) | Robust state persistence engine with atomic writes, migrations, and fallback to in-memory mode. |
| [collections](./packages/collections) | Utility helpers for array chunking and bottom-up directory grouping by path depth. |
| [usage-tracker](./packages/usage-tracker) | Usage & cost tracking: session metrics, cumulative spend, time-windowed limits. |
| [task-list](./packages/task-list) | Unified abstraction for task management across Trello and Linear with polling watchers. |

### Data Processing & Utilities
| Package | Description |
|---------|-----|
| [text](./packages/text) | Text utilities: chunking, formatting, YAML/JSON conversion, markdown escaping, templating, and more. |
| [date-time](./packages/date-time) | Strongly-typed `TimeSpan` with unit-aware multipliers and configurable `TimeUnit` enum. |
| [document-generator](./packages/document-generator) | Fluent document builder outputting to Markdown, Slack mrkdwn, and plain text with platform-aware formatting. |
| [http](./packages/http) | Safe server-side HTTP helpers: body size limits, JSON with CORS, and secure cookie parsing. |
| [rest-client](./packages/rest-client) | Typed REST client with Zod validation, OAuth2/bearer auth, automatic retries, and structured errors. |

### Tooling & Config
| Package | Description |
|---------|-----|
| [shared-config](./packages/shared-config) | Centralized config: TS compiler, postinstall script to sync files, and npm scripts. |
| [ts-config](./packages/ts-config) | Shared TypeScript, ESLint, and Prettier configs (including Next.js support). |
| [logger](./packages/logger) | Pluggable structured logging with console/file/Discord plugins, session-based JSONL, and isolated error handling. |
| [storybook-components](./packages/storybook-components) | Tailwind + React UI library: tokenized primitives (Button, Card, etc.) and composite widgets. |

## GitHub Actions Setup

To enable full CI/CD automation (e.g., publishing, auto-fix commits), configure these repository secrets:

- `NPM_TOKEN`: npm authentication token for publishing packages  
- `PAT_TOKEN`: GitHub Personal Access Token for CI auto-fix commits and repo operations (with `repo` scope)

These secrets enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.