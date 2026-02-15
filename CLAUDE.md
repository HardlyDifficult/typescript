# CLAUDE.md

Monorepo of opinionated TypeScript libraries under the `@hardlydifficult` scope. **One right way to do each thing** — no flexible alternatives.

## Start Here

1. `npm install && npm run build` — install and compile (always from repo root)
2. Read this file for design philosophy and patterns
3. Check `.claude/skills/` for workflow-specific guidance

## Verification

**CRITICAL**: Before every commit, run `npm run fix` to auto-fix lint and format issues in one step:

```bash
npm run fix             # ⭐ ALWAYS RUN FIRST — auto-fixes all lint + format issues
npm run build           # TypeScript compilation
npm run test            # All tests
npm run lint            # ESLint validation (max-lines: 400)
npm run format:check    # Prettier formatting validation
```

**Important**: Run `npm run fix` **before** `npm run build` — it catches and fixes ESLint errors that will block compilation. Always run from **repo root** — turbo handles dependency ordering.

## Packages

- `packages/chat` — Unified Discord/Slack messaging API
- `packages/document-generator` — Rich document builder (Block Kit / Embeds)
- `packages/throttle` — Rate limiting, backoff/retry, ThrottledUpdater, isConnectionError, eventRequest
- `packages/text` — Error formatting, template replacement, text chunking, slugify, duration formatting
- `packages/ai` — Unified AI client (`createAI`, `claude`, `ollama`) with chainable `.text()` and `.zod()`, callback-based streaming (`ai.stream(messages, onText)`), tool-calling agent (`ai.agent(tools).stream(messages, callbacks)`), required `AITracker` + `Logger`, and response parsing (`extractJson`, `extractTyped`, `extractCodeBlock`, multimodal)
- `packages/state-tracker` — Atomic JSON state persistence with async API and auto-save
- `packages/usage-tracker` — Accumulate numeric metrics with session/cumulative dual-tracking and persistence
- `packages/workflow-engine` — State machine with typed statuses, validated transitions, auto `updatedAt`, StateTracker persistence, `DataCursor` for safe nested data navigation, multi-listener `on()`, and `toSnapshot()` serialization
- `packages/logger` — Plugin-based structured logger (Console, Discord, File plugins)
- `packages/task-list` — Provider-agnostic task list management (Trello, Linear)
- `packages/queue` — Prioritized FIFO queue (high/medium/low buckets, O(1) enqueue/dequeue)
- `packages/teardown` — Idempotent resource teardown with signal trapping

Build/test one package: `npx turbo run build --filter=@hardlydifficult/chat`

## Design Philosophy

### Key Principles

- **One way to do each thing.** Never add optional parameters or alternate code paths for the same outcome.
- **Minimal public API surface.** Don't export internal interfaces (`ChannelOperations`, `MessageOperations`), implementation types, or options bags when a simple parameter works.
- **Flat parameters over options objects.** Only use options objects when there are 3+ optional fields.
- **Consistent patterns.** All event subscriptions return an unsubscribe function or use `on`/`off` pairs.
- **Domain objects carry operations.** Write operations live on the objects they affect (`task.update()`, `list.createTask()`), not on the client. Params accept domain objects (`labels: [label]`), not raw IDs — the library extracts IDs internally. Internal `*Operations` interfaces (not exported) bridge domain classes to platform-specific API calls.
- **Chainable finders throw on not found.** State classes like `BoardState.findList(name)` throw instead of returning `null` — enables clean chaining: `state.findBoard("x").findList("y").createTask("z")`.
- **No backward compatibility.** Always break things to make the end product better. No legacy support, redirects, migration logic, or any mention of the old way. Only optimize for the best design going forward.

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

// Stream output into a thread (no placeholder message needed)
// stream() — posts a new message per flush (good for batched/chunked output)
const stream = thread.stream(2000);
stream.append("Processing...\n");
await stream.stop();
console.log(stream.content); // "Processing...\n" — full accumulated text

// editableStream() — edits one message in place (good for token-by-token LLM output)
const editable = thread.editableStream(500);
editable.append("token1 ");
editable.append("token2 ");
await editable.stop();
console.log(editable.content); // "token1 token2 " — full accumulated text

// Both support AbortSignal for cancellation
const controller = new AbortController();
const cancellable = thread.stream(2000, controller.signal);
cancellable.append("working...\n");
controller.abort(); // auto-stops the stream, append() becomes a no-op
```

Both `stream()` and `editableStream()` share the same `append()/stop()/content` caller API. The difference is internal: `StreamingReply` posts new messages per flush, `EditableStreamReply` edits a single message in place. Use `editableStream()` when output arrives token-by-token and you want a single updating message. Use `stream()` when output arrives in larger batches and separate messages are fine. Both accept an optional `AbortSignal` to auto-stop on cancellation.

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

3. **Auto-discovered**: Turbo finds new packages via workspace glob. No registration needed.

4. Verify: `npm run build && npm test && npm run lint && npm run format:check` from repo root

5. **Cross-repo migration**: When extracting code from the ai repo into a new package, grep for ALL usages of old types/functions across the entire ai repo (not just the obvious files). Use `file:../../../typescript/packages/{name}` temporarily in the ai repo's `package.json` to verify builds before publishing to npm — swap back to a version number before committing.

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

### Closure Factory for Stateful Utilities

When a utility needs hidden state but no async init, use a `create*` factory function that returns an interface. Closure-scoped variables replace private fields — no `this` binding issues.

```typescript
export function createTeardown(): Teardown {
  const entries: Entry[] = [];
  let hasRun = false;
  const run = async (): Promise<void> => { /* uses entries, hasRun */ };
  return { add(...) { ... }, run, trapSignals() { ... } };
}
```

Used by: `createThrottledUpdater`, `createTeardown`, `createMessageTracker`.

### PromiseLike Builder for Deferred Execution

When a method returns a value that can be directly awaited OR chained with modifiers before execution, implement `PromiseLike` with lazy execution. The `then()` method triggers actual work only when `await` is reached.

```typescript
interface ChatCall extends PromiseLike<ChatMessage> {
  text(): PromiseLike<string>;
  zod<TSchema extends z.ZodType>(schema: TSchema): PromiseLike<z.infer<TSchema>>;
}

// Usage: await triggers execution
const msg  = await ai.chat(prompt);              // full ChatMessage
const text = await ai.chat(prompt).text();       // string
const data = await ai.chat(prompt).zod(schema);  // z.infer<typeof schema>
```

The `ChatCall` object stores configuration (schema, etc.) until `then()` is called. Inside `then()`, call the actual async work and forward to the promise chain. Chainable methods (`.text()`, `.zod()`) return their own `PromiseLike` that extracts the relevant field internally — consumers get the unwrapped type directly.

Used by: `createAI` in `@hardlydifficult/ai`.

## ESLint Strict Rules — Common Fixes

- **`no-misused-spread`**: Don't spread `RequestInit` or similar external types into object literals. Destructure only the fields you need: `{ method: options.method, body: options.body }`.
- **`restrict-template-expressions`**: Wrap non-string values in `String()`: `` `Error: ${String(response.status)}` ``
- **`strict-boolean-expressions`**: Use explicit checks for optional params: `if (value !== undefined)` not `if (value)`. With optional chaining, `obj?.prop` returns `T | undefined` — use `obj?.prop === true` not `if (obj?.prop)`.
- **`no-non-null-assertion` on array indexing**: `entries[i]!` is unnecessary (and forbidden) because `noUncheckedIndexedAccess` is not enabled — TS already infers `Entry`, not `Entry | undefined`. Just remove the `!`.
- **`no-unnecessary-condition` with arrays**: When checking array contents, prefer length check over undefined: `if (arr.length > 0)` not `if (arr[0] !== undefined)`. More idiomatic and passes strict checking.
- **`no-unnecessary-condition` with generics**: When iterating over generic object keys (e.g., `NumericRecord`), `typeof` checks get flagged because TypeScript narrows the type. Fix: cast to `Record<string, unknown>` at the function boundary so TypeScript accepts the runtime checks.

## Error Handling

**Logger plugins**: All I/O operations (file writes, network calls) must be wrapped in try-catch and swallow errors. Logging infrastructure should never crash the application.

**Constructors must not throw on I/O.** If a constructor touches the filesystem (mkdir, stat), wrap it in try-catch. Downstream code (like `loadAsync()`) should handle graceful degradation. This matters because consumers use top-level `await` with `create()` factories — a throwing constructor crashes any module that imports the file, even indirectly (e.g., a validation script in CI).

## Platform Gotchas

- **Message length limits:** Discord: 2000 chars, Slack: 4000 chars. `postMessage` auto-converts oversized content to file attachments. `updateMessage` truncates with `…` (edits can't attach files). Limits centralized in `packages/chat/src/constants.ts` as `MESSAGE_LIMITS`.
- **Emoji:** Discord uses unicode (`'🗑️'`), Slack uses text names (`':wastebasket:'`). Reaction events return different formats per platform.
- **Slack reactions lack usernames:** Use `event.user.id`, not `event.user.username`.
- **Slack `mimetype` can be `null`:** The Slack API sends `null` (not `undefined`) for missing mime types. Always handle both.
- **Slack bolt event types:** `app.event("message")` gives a complex union type. Define a strict `SlackMessagePayload` interface and cast at the boundary — don't spread `any` through the codebase.
- **Slack file uploads return no message ID:** `filesUploadV2` doesn't reliably return a timestamp. Convention: return `{ id: "" }` for file-only uploads.

## Testing with Fake Timers (vitest)

- Call `await vi.advanceTimersByTimeAsync(0)` to flush microtasks before asserting
- Always restore real timers in `afterEach`
- Use deferred promises instead of `async () => { throw ... }` to avoid unhandled rejection warnings
- **Spy assertions with optional params**: When a method has optional parameters (e.g., `post(content, files?)`), vitest records the call with `undefined` for omitted args. Use `toHaveBeenCalledWith("text", undefined)`, not `toHaveBeenCalledWith("text")`

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
