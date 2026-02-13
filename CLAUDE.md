# CLAUDE.md

## Project Overview

Monorepo of opinionated TypeScript libraries under the `@hardlydifficult` scope.

## Packages

- `packages/chat` — Unified Discord/Slack messaging API
- `packages/document-generator` — Rich document builder (Block Kit / Embeds)

## Design Philosophy

This is an **opinionated** library. There is a single right way to do things. Do not add flexible alternatives or multiple paths to the same outcome.

### Key Principles

- **One way to do each thing.** Never add optional parameters or alternate code paths that let users achieve the same outcome differently.
- **Minimal public API surface.** Don't export internal interfaces (`ChannelOperations`, `MessageOperations`, `ReactionAdder`), implementation types (`SlackBlock`, `ReplyMessage`), or options bags when a simple parameter works.
- **Flat parameters over options objects.** Prefer `startThread(name, autoArchiveDuration?)` over `startThread(name, { autoArchiveDuration })`. Only use options objects when there are 3+ optional fields.
- **Consistent patterns.** All event subscriptions (`onMessage`, `onReaction`, `onDisconnect`, `onError`) return an unsubscribe function or use `on`/`off` pairs, never a mix.

### Thread Messaging

The **only** way to post to a thread is `msg.reply()`. Never use `channel.postMessage()` with a `threadTs` option. The public API intentionally does not expose `threadTs` on `postMessage`.

```typescript
// Correct — the only way to reply in a thread
const msg = await channel.postMessage("Hello");
msg.reply("Thread reply");

// Wrong — do not add threadTs to postMessage
channel.postMessage("reply", { threadTs: "..." }); // NOT supported
```

## Commands

Always run from the **repo root** so turbo handles dependency ordering (e.g. builds `document-generator` before `chat`):

- **Setup:** `npm install` (from repo root — installs all workspace packages)
- **Build all:** `npm run build`
- **Test all:** `npm run test`
- **Build one package:** `npx turbo run build --filter=@hardlydifficult/chat`
- **Test one package:** `npx turbo run test --filter=@hardlydifficult/chat`
- **Lint:** `npx turbo run lint --filter=@hardlydifficult/chat`
- **Full CI check (lint + format):** `npm run lint && npm run format:check`
- **Auto-fix lint + format:** `npm run fix`

Avoid running `npm run build` or `npx vitest run` directly from a package directory — that bypasses turbo and will fail if upstream packages (like `document-generator`) haven't been built yet.

### Pre-commit CI checklist

Before committing, always verify these pass (CI runs all of them):

1. `npm run build` — TypeScript compilation
2. `npm run lint` — ESLint (includes `max-lines: 400` per file)
3. `npm run format:check` — Prettier formatting
4. `npm run test` — All tests

## Checklist for API Changes

When adding, removing, or changing any public method or type:

1. Update the package's `README.md` with usage examples
2. Add or update tests covering the new behavior
3. Implement for **both** Discord and Slack (both platform clients must satisfy the shared interfaces)

### Adding Channel/Message convenience methods

Higher-level convenience methods (like `withTyping`, `setReactions`, `postDismissable`) can live on the `Channel` or `Message` class directly — they don't require changes to `ChannelOperations` or `MessageOperations` when they delegate to existing operations.

### Platform emoji differences

Discord uses unicode emoji (`'🗑️'`) while Slack uses text names (`':wastebasket:'`). Reaction events return `'🗑️'` on Discord vs `'wastebasket'` on Slack. Any method that hardcodes emoji must handle both via `this.platform`.

### Slack reaction events lack usernames

Slack reaction events only provide a user ID — `event.user.username` is always `undefined`. Use `event.user.id` for cross-platform user matching, not `event.user.username`.

### Testing with fake timers (vitest)

When using `vi.useFakeTimers()` with async code that chains multiple `await`s (like the Discord client's `sendTyping` → `fetchTextChannel` → `channel.sendTyping`), call `await vi.advanceTimersByTimeAsync(0)` to flush microtasks before asserting. Always restore real timers in `afterEach` to prevent cascading timeouts if a test fails. Use deferred promises (`new Promise` with external `resolve`/`reject`) instead of `async () => { throw ... }` to avoid unhandled rejection warnings.

## Code Size Limits

ESLint enforces `max-lines: 400` (skipping blanks and comments). Hitting this limit signals that a file is doing too much — extract repeated patterns into helpers or split distinct concerns into separate modules. Don't just trim comments to fit.

**Example:** Discord's `fetchTextChannel` helper eliminated 9 copies of the same fetch-and-validate boilerplate so each new operation doesn't grow the file.

When adding a new method to both platform clients (`DiscordChatClient`, `SlackChatClient`) would push either file over the limit, extract the implementation into a dedicated helper file in the platform directory (e.g., `discord/fetchChannelMembers.ts`, `slack/fetchChannelMembers.ts`). The client method becomes a thin delegation call. This keeps distinct concerns in separate modules rather than compacting code to fit.
