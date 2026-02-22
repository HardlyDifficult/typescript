# CLAUDE.md

Infrastructure package monorepo — 26 focused npm packages published as `@hardlydifficult/*`. Used by the companion AI repo (`/home/user/ai`) for all general-purpose infrastructure.

## Start Here

1. `npm install && npm run build` — install and compile everything
2. Read this file for structure and patterns
3. `npm run fix` before every commit (lint + format)

## Verification

**IMPORTANT**: Always verify before committing:

```bash
npm run build    # Must pass — TypeScript compilation for all packages
npm run fix      # Must pass — ESLint + Prettier auto-fix (CI enforces strict rules)
```

## Commands

```bash
npm install          # Install all dependencies
npm run build        # Build all packages (Turbo)
npm test             # Run all tests (Vitest)
npm run fix          # Lint fix + format (run before every commit)
npm run lint         # ESLint only
npm run format       # Prettier only
npm run clean        # Clean all dist/ directories
```

## Package Discovery

Here's how to explore this repo. These are pre-executed tool examples — they show the tool pattern AND provide real content upfront:

### Explore the repo to see all packages

<tool_use>
Bash: ls /home/user/typescript/packages/
</tool_use>
<tool_result>
agent-tools  ai  chat  ci-scripts  collections  daemon  date-time
document-generator  github  http  logger  poller  pr-analyzer  queue
repo-processor  rest-client  shared-config  state-tracker  task-list
text  throttle  ts-config  usage-tracker  websocket  worker-server
workflow-engine
</tool_result>

### Read the repo README for a categorized overview

<tool_use>
Read: /home/user/typescript/README.md
</tool_use>
<tool_result>
# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages for building robust, scalable TypeScript applications — from AI integrations to CI automation, messaging, and state management.

## AI & LLMs

| Package | Description |
|---------|-------------|
| ai | Unified LLM client (Anthropic/Ollama) with agent orchestration, streaming, caching, and multimodal message handling |
| agent-tools | Core utilities for safe, predictable agent execution: I/O limits, path parsing, and result formatting |

## GitHub & CI

| Package | Description |
|---------|-------------|
| github | PR monitoring: polling, activity fetching, change detection, and high-level GitHub clients |
| pr-analyzer | PR analysis pipeline: CI status, reviews, conflicts, bot mentions, and actionable classification |
| ci-scripts | CI automation for versioning, tagging, lint/format auto-fixes, and dependency pinning validation |
| repo-processor | Incremental GitHub repo processor with SHA-based stale detection and YAML persistence |

## Async & Control Flow

| Package | Description |
|---------|-------------|
| queue | High-performance priority queue with O(1) ops, FIFO within priorities, and observer-driven updates |
| poller | Generic polling with debouncing, overlapping request suppression, and change detection via equality checks |
| throttle | Rate-limiting with token-bucket, exponential backoff, transient error detection, and persistence |
| daemon | Robust daemon utilities: signal-handled teardown, interruptible loops with dynamic delays |
| workflow-engine | Typed workflow engine with state machines, cursors, persistence, gate pausing, and lifecycle hooks |

## Messaging & Servers

| Package | Description |
|---------|-------------|
| chat | Cross-platform chat abstraction (Discord/Slack) with unified APIs for messaging, threads, commands, and streaming |
| websocket | Robust WebSocket client with exponential reconnection, token refresh, and heartbeat health checks |
| worker-server | WebSocket-based worker server with health checks, dynamic routing, and category-specific concurrency |

## Data & State

| Package | Description |
|---------|-------------|
| state-tracker | Robust state persistence with atomic writes, schema migrations, and auto-save with fallback mode |
| usage-tracker | Usage and cost tracking: session/cumulative metrics, USD spend limits, and cross-session persistence |

## Utilities

| Package | Description |
|---------|-------------|
| collections | Array chunking and path depth grouping for bottom-up directory processing |
| date-time | Typed TimeSpan with unit-aware multipliers and configurable TimeUnit enum |
| text | Text utilities: chunking, YAML/JSON, markdown escaping, templating, slugification, and linkification |
| http | Safe HTTP utilities: body size limits, CORS-enabled JSON responses, and secure cookie parsing |
| logger | Structured logging with pluggable outputs (console/file/Discord), per-plugin filtering, and JSONL sessions |
| rest-client | Typed REST client with Zod validation, retry logic, OAuth2/bearer auth, and structured errors |
| task-list | Abstract task management (Trello/Linear) with unified CRUD, deferred APIs, and task watching |
| shared-config | Centralized config with auto-synced files and npm scripts for build/linting |
| ts-config | Shared TypeScript, ESLint, and Prettier configs (including Next.js support) |
| document-generator | Fluent document generator for Markdown, Slack mrkdwn, and plain text with platform-aware formatting |
</tool_result>

### Drill into a specific package for API details

<tool_use>
Read: /home/user/typescript/packages/text/README.md
</tool_use>

This gives the full API docs with usage examples, installation, and type signatures. Do this for any package you need to understand.

## Package Structure

Every package follows the same layout:

```
packages/{name}/
├── README.md          # Full API docs — the primary reference
├── package.json       # Name: @hardlydifficult/{name}
├── tsconfig.json      # Extends ../../tsconfig.base.json
├── vitest.config.ts   # Test configuration
├── src/               # Source code
│   ├── index.ts       # Barrel exports — the public API
│   └── ...
└── tests/             # Test files
    └── *.test.ts
```

Build output goes to `dist/` (gitignored). Each package declares its own dependencies in `package.json`.

## Key Rules

- **`npm run fix` before every commit.** CI enforces strict ESLint (e.g., `default-case`) and Prettier formatting. Running `fix` auto-corrects most issues.
- **No `package-lock.json` in git.** The `.gitignore` excludes it — it's noisy and causes conflicts.
- **Never manually bump patch versions.** The publish CI script (`ci-scripts/publish.ts`) auto-determines patch versions by querying npm for the latest `major.minor.x` and incrementing. Only `major.minor` matters in `package.json`.
- **Pin all dependencies.** Use exact versions (`"1.0.2"`) not semver ranges (`"^1.0.2"`). CI checks enforce this.
- **ESM only.** All packages use `"type": "module"`. Use `import`/`export`, not `require`.

## Adding a New Package

1. Create `packages/{name}/` with the structure above
2. Add `package.json` with `"name": "@hardlydifficult/{name}"`, `"version": "0.1.0"`, `"type": "module"`
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Add `vitest.config.ts`
5. Export from `src/index.ts`
6. Write a comprehensive `README.md` — this is the primary API reference for consumers

## Multi-Repo Development

When the AI repo needs changes to a package here:

1. Make changes in this repo first
2. Build from the repo root: `npm run build`
3. Test locally by copying dist to the AI repo:
   ```bash
   cp -r /home/user/typescript/packages/{pkg}/dist/* /home/user/ai/node_modules/@hardlydifficult/{pkg}/dist/
   ```
4. Create PRs on matching branch names for tracking
5. After merging here, wait for the publish workflow before updating AI repo dependencies
