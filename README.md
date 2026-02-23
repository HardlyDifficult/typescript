# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## Packages

### AI
| Package | Description |
|---------|-------------|
| [ai](./packages/ai) | Unified AI/LLM integration with client abstraction, agent orchestration, streaming, and structured output. Supports Anthropic, Ollama, tool-calling, caching, and multimodal messaging. |
| [agent-tools](./packages/agent-tools) | Core tooling for safe, config-driven agent execution with GitHub-style path parsing, I/O limits, and error formatting. Includes result helpers and utility functions. |

### GitHub / CI
| Package | Description |
|---------|-------------|
| [ci-scripts](./packages/ci-scripts) | CI/CD automation: auto-fix commits, pinned deps, topological publishing with npm versioning |
| [github](./packages/github) | PR monitoring, branch polling, timeline building, and event-driven change detection |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis pipeline for status, reviews, conflicts, and actionable classification into ready/blocked/needs-bump buckets |
| [repo-processor](./packages/repo-processor) | Incremental GitHub repo processor with SHA-based change detection and git-backed YAML state persistence |

### Async / Control Flow
| Package | Description |
|---------|-------------|
| [daemon](./packages/daemon) | Node.js daemon utilities for long-running background processes |
| [poller](./packages/poller) | Generic polling utility with debouncing, skip tracking, and change detection (shallow/deep) |
| [queue](./packages/queue) | High-performance priority queue with O(1) ops, FIFO within levels, and dynamic updates via observer pattern |
| [throttle](./packages/throttle) | Token-bucket throttling with persistence, exponential backoff, and retry logic |
| [websocket](./packages/websocket) | Robust WebSocket client with reconnection, token refresh, and health checks |
| [worker-server](./packages/worker-server) | WebSocket-based worker manager with health monitoring and category-specific concurrency controls |

### Messaging
| Package | Description |
|---------|-------------|
| [chat](./packages/chat) | Cross-platform chat abstraction (Discord/Slack) with unified APIs for messaging, threads, commands, and streaming |
| [http](./packages/http) | Safe HTTP utilities: body size limits, CORS, and structured response handling |
| [rest-client](./packages/rest-client) | Typed REST client with OAuth2, Zod validation, retry, and structured errors |

### Data / State
| Package | Description |
|---------|-------------|
| [collections](./packages/collections) | Array chunking and filesystem path depth grouping for bottom-up processing |
| [date-time](./packages/date-time) | Strongly-typed `TimeSpan` with unit-aware multipliers and configurable enum |
| [state-tracker](./packages/state-tracker) | Atomic state persistence with schema migrations, debounced save, and fallback modes |
| [usage-tracker](./packages/usage-tracker) | Session & cumulative usage tracking with spend limits and cost monitoring |

### Text & Document
| Package | Description |
|---------|-------------|
| [document-generator](./packages/document-generator) | Fluent API for composing rich content with Markdown/Slate/Slack mrkdwn output |
| [text](./packages/text) | Text utilities for chunking, formatting, YAML/JSON conversion, templating, and linkification |
| [task-list](./packages/task-list) | Provider-agnostic task list abstraction (Trello/Linear) with polling-based watching |

### Storybook
| Package | Description |
|---------|-------------|
| [storybook-components](./packages/storybook-components) | React component library for Storybook with atomic and composite widgets |

### Tooling
| Package | Description |
|---------|-------------|
| [shared-config](./packages/shared-config) | Centralized config: TS, ESLint, Prettier, with auto-sync scripts |
| [ts-config](./packages/ts-config) | Shared ESLint (flat), Prettier, and TS config (base + Next.js) |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine with state machines, persistence, gates, and retry hooks |

### Utilities
| Package | Description |
|---------|-------------|
| [logger](./packages/logger) | Pluggable structured logging with console/file/Discord output, per-plugin filtering, and JSONL session tracking |

## GitHub Actions Setup

To enable full CI/CD automation (e.g., publishing, auto-fix commits), configure these repository secrets:

- `NPM_TOKEN`: npm authentication token for publishing packages  
- `PAT_TOKEN`: GitHub Personal Access Token for CI auto-fix commits and repo operations (with `repo` scope)

These secrets enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.