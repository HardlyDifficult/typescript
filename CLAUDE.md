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

Avoid running `npm run build` or `npx vitest run` directly from a package directory — that bypasses turbo and will fail if upstream packages (like `document-generator`) haven't been built yet.

## Checklist for API Changes

When adding, removing, or changing any public method or type:

1. Update the package's `README.md` with usage examples
2. Add or update tests covering the new behavior
3. Implement for **both** Discord and Slack (both platform clients must satisfy the shared interfaces)
