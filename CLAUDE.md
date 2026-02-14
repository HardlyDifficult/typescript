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
```

Always run from **repo root** — turbo handles dependency ordering (e.g. `document-generator` before `chat`).

## Packages

- `packages/chat` — Unified Discord/Slack messaging API
- `packages/document-generator` — Rich document builder (Block Kit / Embeds)
- `packages/throttle` — Rate limiting, backoff/retry, ThrottledUpdater, isConnectionError
- `packages/text` — Error formatting, template replacement, text chunking
- `packages/ai-msg` — AI response extraction (JSON, typed schemas, code blocks, multimodal)
- `packages/state-tracker` — Atomic JSON state persistence with async API and auto-save
- `packages/logger` — Plugin-based structured logger (Console, Discord, File plugins)

Build/test one package: `npx turbo run build --filter=@hardlydifficult/chat`

## Design Philosophy

### Key Principles

- **One way to do each thing.** Never add optional parameters or alternate code paths for the same outcome.
- **Minimal public API surface.** Don't export internal interfaces (`ChannelOperations`, `MessageOperations`), implementation types, or options bags when a simple parameter works.
- **Flat parameters over options objects.** Only use options objects when there are 3+ optional fields.
- **Consistent patterns.** All event subscriptions return an unsubscribe function or use `on`/`off` pairs.

### Thread Messaging

The **only** way to post to a thread is `msg.reply()`. Never use `channel.postMessage()` with a `threadTs` option — the API intentionally does not expose it.

```typescript
// Correct — the only way
const msg = await channel.postMessage("Hello");
msg.reply("Thread reply");
```

## API Change Checklist

1. Update the package's `README.md` with usage examples
2. Add or update tests
3. Implement for **both** Discord and Slack

### Adding Channel/Message convenience methods

Higher-level methods (`withTyping`, `setReactions`, `postDismissable`) can live on `Channel` or `Message` directly — they don't require changes to `ChannelOperations` or `MessageOperations` when they delegate to existing operations.

## Platform Gotchas

- **Emoji:** Discord uses unicode (`'🗑️'`), Slack uses text names (`':wastebasket:'`). Reaction events return different formats per platform.
- **Slack reactions lack usernames:** Use `event.user.id`, not `event.user.username`.

## Testing with Fake Timers (vitest)

- Call `await vi.advanceTimersByTimeAsync(0)` to flush microtasks before asserting
- Always restore real timers in `afterEach`
- Use deferred promises instead of `async () => { throw ... }` to avoid unhandled rejection warnings

## Code Size Limits

ESLint enforces `max-lines: 400` (skipping blanks/comments). When over the limit, extract helpers or split into platform-specific files (e.g., `discord/fetchChannelMembers.ts`). Don't trim comments to fit.

## Skills

- `gg/` — Capture session learnings into docs
- `git-workflows/` — Git operations, PR creation, review loop
- `coordinating-subagents/` — Parallel agent coordination
- `creating-task-files/` — Structured task documentation
- `processing-bot-reviews/` — Triage AI bot PR feedback
- `typescript-strict/` — Strict TypeScript typing guidelines
- `browser-automation/` — Headless browser testing
- `ui-testing/` — Visual UI testing and bug documentation
