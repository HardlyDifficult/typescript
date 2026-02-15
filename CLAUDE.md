# CLAUDE.md

Monorepo of opinionated TypeScript libraries under the `@hardlydifficult` scope. **One right way to do each thing** — no flexible alternatives.

## Start Here

1. `npm install && npm run build` — install and compile (always from repo root)
2. Read this file for design philosophy and patterns
3. Check `.claude/skills/` for workflow-specific guidance

## Verification

**IMPORTANT**: Run all checks before committing (CI runs all of these):

```bash
npm run build           # TypeScript compilation
npm run lint            # ESLint (includes max-lines: 400)
npm run format:check    # Prettier formatting
npm run test            # All tests
npm run fix             # Auto-fix lint + format issues
npm run docs            # Build docs site (Astro Starlight + TypeDoc API reference)
npm run docs:dev        # Local docs dev server with hot reload
npm run docs:agent      # Generate llms.txt / llms-full.txt
```

Always run from **repo root** — turbo handles dependency ordering (e.g. `document-generator` before `chat`).

## Packages

- `packages/chat` — Unified Discord/Slack messaging API
- `packages/document-generator` — Rich document builder (Block Kit / Embeds)
- `packages/throttle` — Rate limiting, backoff/retry, ThrottledUpdater, isConnectionError
- `packages/text` — Error formatting, template replacement, text chunking
- `packages/ai-msg` — AI response extraction (JSON, typed schemas, code blocks, multimodal)
- `packages/state-tracker` — Atomic JSON state persistence with async API and auto-save
- `packages/usage-tracker` — Accumulate numeric metrics with session/cumulative dual-tracking and persistence
- `packages/workflow-engine` — State machine with typed statuses, validated transitions, and StateTracker persistence
- `packages/logger` — Plugin-based structured logger (Console, Discord, File plugins)

Build/test one package: `npx turbo run build --filter=@hardlydifficult/chat`

## Design Philosophy

### Key Principles

- **One way to do each thing.** Never add optional parameters or alternate code paths for the same outcome.
- **Minimal public API surface.** Don't export internal interfaces (`ChannelOperations`, `MessageOperations`), implementation types, or options bags when a simple parameter works.
- **Flat parameters over options objects.** Only use options objects when there are 3+ optional fields.
- **Consistent patterns.** All event subscriptions return an unsubscribe function or use `on`/`off` pairs.

### Thread Messaging

`Thread` is the primary interface for thread interactions. Create one via `channel.createThread()` or `msg.startThread()`. Reconnect to an existing thread via `channel.openThread(threadId)`. All threading internals (threadId, thread_ts) are hidden — Thread handles routing.

```typescript
const thread = await channel.createThread("Starting a session!", "Session");
await thread.post("How can I help?");

thread.onReply(async (msg) => {
  await thread.post(`Got: ${msg.content}`);
  await msg.reply("Thanks!"); // also posts in the same thread
});

thread.offReply();
await thread.delete();

// Reconnect to an existing thread by ID (e.g., after a restart)
const existing = channel.openThread(savedThreadId);
await existing.post("I'm back!");
```

- `msg.reply()` always stays in the same thread (wired via `createThreadMessageOps`)
- `channel.onMessage()` only fires for top-level messages on **both** platforms
- Discord threads are channels (`channelId = threadId`); Slack threads use `thread_ts` on the parent channel
- Never use `channel.postMessage()` with a `threadTs` option — the API intentionally does not expose it

## Creating a New Package

1. Create `packages/{name}/` with these files:
   - `package.json` — name `@hardlydifficult/{name}`, main `./dist/index.js`, types `./dist/index.d.ts`, files `["dist"]`. Pin exact versions: `typescript: "5.8.3"`, `vitest: "1.6.1"`, `@types/node: "20.19.31"`
   - `tsconfig.json` — extends `../../tsconfig.base.json`, outDir `./dist`, rootDir `./src`
   - `vitest.config.ts` — copy from any existing package (identical across all)
   - `src/index.ts` — barrel exports with `.js` extensions
   - `tests/*.test.ts` — one test file per source module
   - `README.md` — installation, API reference, examples

2. **Inter-package dependencies**: Use `file:../` in devDependencies + peerDependencies (see `throttle` → `state-tracker` pattern)

3. **Docs**: Add the package to `entryPoints` in `apps/docs/astro.config.mjs` and `LIBRARY_PACKAGES` in `packages/ci-scripts/src/generate-llms-txt.ts`.

4. **Auto-discovered**: Turbo finds new packages via workspace glob. No registration needed.

5. Verify: `npm run build && npm test && npm run lint && npm run format:check` from repo root

## Keeping Docs Current

When adding or changing packages, update the relevant docs so future sessions start fast:
- Package's `README.md` — API docs and examples
- Root `README.md` — package table
- `CLAUDE.md` Packages list — add new packages
- AI repo `CLAUDE.md` package table — if the AI repo will use it
- AI repo `CLAUDE.md` Architecture — if the AI repo adds new agents/services using it

## API Change Checklist

1. Update the package's `README.md` with usage examples
2. Add or update tests
3. Implement for **both** Discord and Slack

### Adding Channel/Message/Thread convenience methods

Higher-level methods (`withTyping`, `setReactions`, `postDismissable`, `openThread`) can live on `Channel`, `Message`, or `Thread` directly — they don't require changes to `ChannelOperations` or `MessageOperations` when they delegate to existing operations. `Channel.buildThread()` wires up all thread ops from existing `ChannelOperations`, so new Thread entry points (like `openThread`) need zero platform changes.

## Design Patterns

### Static Factory for Async Init

Classes that need async initialization (loading from disk, fetching config) should use a static `create()` factory method with a **private constructor**. This lets consumers declare and initialize in one line:

```typescript
// Good: one-line creation + async load
const tracker = await UsageTracker.create({ key: 'my-usage', default: { ... } });

// Bad: two-step init
const tracker = new UsageTracker(...);
await tracker.load();
```

Used by: `UsageTracker`. `WorkflowEngine` uses a similar pattern.

## Platform Gotchas

- **Emoji:** Discord uses unicode (`'🗑️'`), Slack uses text names (`':wastebasket:'`). Reaction events return different formats per platform.
- **Slack reactions lack usernames:** Use `event.user.id`, not `event.user.username`.
- **Slack `mimetype` can be `null`:** The Slack API sends `null` (not `undefined`) for missing mime types. Always handle both.
- **Slack bolt event types:** `app.event("message")` gives a complex union type. Define a strict `SlackMessagePayload` interface and cast at the boundary — don't spread `any` through the codebase.

## ESLint Gotchas

- **Generic utility functions with `typeof` checks**: When iterating over generic object keys (e.g., `NumericRecord`), `typeof sourceValue === 'number'` gets flagged by `no-unnecessary-condition` because TypeScript narrows the type. Fix: cast to `Record<string, unknown>` at the function boundary so TypeScript accepts the runtime checks.

## Testing with Fake Timers (vitest)

- Call `await vi.advanceTimersByTimeAsync(0)` to flush microtasks before asserting
- Always restore real timers in `afterEach`
- Use deferred promises instead of `async () => { throw ... }` to avoid unhandled rejection warnings

## Code Size Limits

ESLint enforces `max-lines: 400` (skipping blanks/comments). Treat this as an architecture nudge — split by **responsibility**, not just line count. Group related operations into themed modules (e.g., `discord/threadOperations.ts`, `discord/buildMessagePayload.ts`, `slack/buildMessageEvent.ts`). Don't trim comments to fit.

## API Tokens

- `$GH_PAT` — GitHub PAT for API access and PR operations. Use with `gh`: `GH_TOKEN="$GH_PAT" gh pr view`
- `$TRELLO_API_KEY` / `$TRELLO_API_TOKEN` — Trello API for creating cards directly

## Skills

- `gg/` — Capture session learnings into docs
- `git-workflows/` — Git operations, PR creation, review loop
- `coordinating-subagents/` — Parallel agent coordination
- `creating-task-files/` — Structured task documentation
- `processing-bot-reviews/` — Triage AI bot PR feedback
- `typescript-strict/` — Strict TypeScript typing guidelines
- `browser-automation/` — Headless browser testing
- `ui-testing/` — Visual UI testing and bug documentation
