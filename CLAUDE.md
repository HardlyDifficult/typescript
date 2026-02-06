# CLAUDE.md

## Project Overview

Monorepo of opinionated TypeScript libraries under the `@hardlydifficult` scope.

## Packages

- `packages/chat` — Unified Discord/Slack messaging API
- `packages/documentGenerator` — Rich document builder (Block Kit / Embeds)

## Design Philosophy

This is an **opinionated** library. There is a single right way to do things. Do not add flexible alternatives or multiple paths to the same outcome.

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

- **Build:** `npm run build` (from package dir)
- **Test:** `npx vitest run` (from package dir)
- **Lint:** `npx tsc --noEmit` (from package dir)
