# CLAUDE.md

Monorepo of focused, opinionated TypeScript packages published to npm under `@hardlydifficult/*`. These packages are the infrastructure layer consumed by the `HardlyDifficult/ai` repo.

## Start Here

1. `npm install && npm run build` — install and compile everything
2. Read this file for architecture and patterns
3. Check the companion `ai` repo at `/home/user/ai/CLAUDE.md` for how these packages are used

## Session Workflow

**Every session (code or plan) MUST include both repos:**

| Repo | Path | Role |
|------|------|------|
| `HardlyDifficult/typescript` | `/home/user/typescript` | Primary (this repo) |
| `HardlyDifficult/ai` | `/home/user/ai` | Always included |

At the **end of every session**:
1. Run verification in **both** repos (see Verification below)
2. Commit any changes in each repo that has them
3. Open a PR for **each** repo that has commits — use matching branch names
4. See `/home/user/ai/.claude/skills/git-workflows/SKILL.md` for the full PR workflow

## Verification

**IMPORTANT**: Always verify before committing:

**This repo (`typescript`):**
```bash
npm run build   # Must pass — all packages compile
npm run fix     # Lint + format (run before committing)
```

**`ai` repo:**
```bash
cd /home/user/ai
npm run build            # Must pass — TypeScript compilation for all packages
npm run validate -w @ai/bot  # Must pass — catches command prefix conflicts
```

## Packages

| Package | Description |
|---------|-------------|
| `@hardlydifficult/ai` | Unified LLM client (Anthropic/Ollama) with agent orchestration, streaming, caching |
| `@hardlydifficult/agent-tools` | Safe, predictable agent execution: I/O limits, path parsing, result formatting |
| `@hardlydifficult/chat` | Discord/Slack messaging + command framework: Channel, Message, Thread, CommandRegistry |
| `@hardlydifficult/github` | PR monitoring, activity fetching, change detection, GitHub clients |
| `@hardlydifficult/pr-analyzer` | PR analysis pipeline: CI status, reviews, conflicts, bot mentions, classification |
| `@hardlydifficult/logger` | Structured logging with Console, Discord, and File plugins |
| `@hardlydifficult/text` | Error→string, templates, chunking, slugs, duration |
| `@hardlydifficult/throttle` | Rate limiting, backoff, retry, event→promise |
| `@hardlydifficult/state-tracker` | Persistent state with auto-save |
| `@hardlydifficult/usage-tracker` | Numeric metric accumulation |
| `@hardlydifficult/queue` | Prioritized FIFO queue |
| `@hardlydifficult/daemon` | Idempotent resource teardown |
| `@hardlydifficult/http` | Timing-safe comparison, HTTP body/response |
| `@hardlydifficult/workflow-engine` | Typed state machine + pipelines |
| `@hardlydifficult/repo-processor` | Incremental GitHub repo file-tree processing |
| `@hardlydifficult/task-list` | Task list management (Linear integration) |
| `@hardlydifficult/websocket` | WebSocket utilities |
| `@hardlydifficult/worker-server` | Worker server infrastructure |
| `@hardlydifficult/poller` | Polling utilities |
| `@hardlydifficult/rest-client` | REST client helpers |
| `@hardlydifficult/collections` | Collection utilities |
| `@hardlydifficult/date-time` | Date/time utilities |
| `@hardlydifficult/document-generator` | Document generation |
| `@hardlydifficult/storybook-components` | Storybook component library |
| `@hardlydifficult/ci-scripts` | CI automation: versioning, tagging, lint/format, dependency pinning |
| `@hardlydifficult/shared-config` | Shared ESLint/TypeScript/Prettier config |
| `@hardlydifficult/ts-config` | Base TypeScript configurations |

## Key Patterns

- **Strict ESLint**: `default-case`, `strict-boolean-expressions`, `no-unnecessary-condition`, `no-non-null-assertion` — CI enforces all rules. Always run `npm run fix` before committing.
- **Pin all dependencies**: Exact versions only — no `^` or `~`. CI enforces this.
- **Never manually bump patch versions**: The publish CI script (`ci-scripts/publish.ts`) auto-determines patch versions by querying npm. Only `major.minor` matters in package.json.
- **Build from repo root**: Packages have inter-dependencies — always `npm run build` from the root, not per-package.
- **Auto-generated READMEs**: Each package's `README.md` is generated. Update source docs/jsdoc, not the README directly.
- **ESM only**: All packages are `"type": "module"`. Use `import.meta.url` patterns, not `__dirname`.

## Multi-Repo Feature Development

When adding features that span both repos:

1. **Sequence**: typescript repo first (for npm publish), then ai repo
2. **PR dependency**: AI PR should reference TypeScript PR and note build will fail until TypeScript PR is merged
3. **Testing locally before publish**:
   ```bash
   # Build from root
   cd /home/user/typescript && npm run build

   # Copy dist to ai repo for local testing
   cp -r /home/user/typescript/packages/{package}/dist/* /home/user/ai/node_modules/@hardlydifficult/{package}/dist/

   cd /home/user/ai && npm run build
   ```
4. **Don't reference unpublished versions** in the ai repo. After typescript PR merges, wait for publish CI to complete, then check actual published versions with `npm outdated | grep hardlydifficult`.

## Commands

```bash
npm install              # Install all dependencies
npm run build            # Build all packages (Turbo)
npm run test             # Run all tests
npm run lint             # Lint all packages
npm run fix              # Lint + format (run before committing)
npm run format           # Format all packages
npm run clean            # Clean build artifacts
```
