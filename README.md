# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust TypeScript applications — from AI integrations to workflow automation.

## Packages

### AI & Language Models
| Package | Description |
|---------|-------------|
| [ai](./packages/ai) | Core AI SDK with Anthropic/ollama integrations, agent tool-calling, and robust response parsing |

### GitHub & CI Automation
| Package | Description |
|---------|-------------|
| [github](./packages/github) | Typed, polling-based GitHub API client for PR monitoring with state snapshotting |
| [ci-scripts](./packages/ci-scripts) | CI utilities for monorepo publishing, dependency validation, and auto-lint/fix commits |

### Async & Control Flow
| Package | Description |
|---------|-------------|
| [poller](./packages/poller) | Generic polling utility with deep-equality change detection and debounced triggers |
| [throttle](./packages/throttle) | Rate-limiting with exponential backoff and connection error detection |
| [teardown](./packages/teardown) | Idempotent resource cleanup with signal trapping and LIFO execution order |
| [workflow-engine](./packages/workflow-engine) | Typed workflow engine with state machines, data cursors, and lifecycle hooks |

### Messaging & Integration
| Package | Description |
|---------|-------------|
| [chat](./packages/chat) | Platform-agnostic chat bot with Discord/Slack support, batching, threading, and streaming |
| [websocket](./packages/websocket) | Resilient WebSocket client with reconnection, heartbeat, and request tracking |
| [worker-server](./packages/worker-server) | WebSocket-based worker server with health monitoring and load balancing |

### Data & State Management
| Package | Description |
|---------|-------------|
| [state-tracker](./packages/state-tracker) | Robust state persistence with atomic writes and automatic fallback to in-memory mode |
| [usage-tracker](./packages/usage-tracker) | Usage and cost tracking with session/cumulative metrics and persisted state |
| [queue](./packages/queue) | High-performance priority queue with O(1) operations and dynamic reordering |

### Tools & Utilities
| Package | Description |
|---------|-------------|
| [collections](./packages/collections) | Low-level utilities for array chunking and hierarchical path grouping |
| [date-time](./packages/date-time) | Strongly-typed TimeSpan utility with millisecond conversion |
| [document-generator](./packages/document-generator) | Fluent document generation for Markdown, Slack mrkdwn, and plain text |
| [http](./packages/http) | HTTP utilities with constant-time comparison, body limits, and CORS |
| [logger](./packages/logger) | Plugin-based structured logging with configurable handlers and severity filtering |
| [pr-analyzer](./packages/pr-analyzer) | PR analysis pipeline for GitHub: aggregates CI/reviews/conflicts and determines merge readiness |
| [repo-processor](./packages/repo-processor) | Incremental GitHub repo processor with bottom-up file handling and tree diff detection |
| [task-list](./packages/task-list) | Provider-agnostic task-list abstraction with Trello/Linear integrations |
| [text](./packages/text) | Text processing utilities for chunking, formatting, and YAML/JSON conversion |
| [shared-config](./packages/shared-config) | Shared configs (TS/ESLint/Prettier) auto-synced to repo root |

### Tooling & Infrastructure
| Package | Description |
|---------|-------------|
| [ts-config](./packages/ts-config) | Shareable TypeScript, ESLint (flat config), and Prettier configs |

## GitHub Actions Setup

To enable full automation in this monorepo, ensure the following secrets are configured:

- `NPM_TOKEN` – Required for publishing packages to npm (set as a repository secret in GitHub)
- `PAT_TOKEN` – Required for auto-fixing lint issues and tagging releases in CI (must be a GitHub Personal Access Token with `repo` scope)

These enable CI scripts (in [`ci-scripts`](./packages/ci-scripts)) to auto-version, lint, and publish packages.