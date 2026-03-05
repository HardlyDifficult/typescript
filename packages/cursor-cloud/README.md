# @hardlydifficult/cursor-cloud

Typed client for the [Cursor Cloud Agent API](https://api.cursor.com).

## Installation

```bash
npm install @hardlydifficult/cursor-cloud
```

## Configuration

```typescript
import { createCursorCloud } from "@hardlydifficult/cursor-cloud";

// Reads CURSOR_API_KEY from env by default.
const cursor = createCursorCloud();

// Or pass the key explicitly with an optional base URL override:
const cursor = createCursorCloud({
  apiKey: "your-api-key",
  baseUrl: "https://api.cursor.com", // optional
});
```

Authentication uses **HTTP Basic auth** — the API key is sent as the username with an empty password.

## Core Methods

### `createAgent(params)` — `POST /v0/agents`

Launch a new agent session.

```typescript
const agent = await cursor.createAgent({
  prompt: "Fix the failing CI tests and open a PR",
  repository: "owner/repo",
  branch: "main",            // optional, defaults to "main"
  model: "cursor-small",     // optional
  webhook: {                 // optional — called when the agent finishes
    url: "https://example.com/webhook",
    secret: "shared-secret", // optional HMAC signing secret
  },
});

console.log(agent.id); // use this ID for subsequent calls
```

### `listAgents(options?)` — `GET /v0/agents`

List agents with optional filters and pagination.

By default, archived sessions are hidden to match Cursor's browser experience.
Pass `includeArchived: true` to include archived sessions in results.

```typescript
const list = await cursor.listAgents({
  repository: "owner/repo",
  status: "running",
  includeArchived: false, // default
  limit: 20,
  offset: 0,
});

console.log(list.agents, list.total, list.hasMore);
```

### `getAgent(id)` — `GET /v0/agents/{id}`

Get current status and metadata for an agent.

```typescript
const agent = await cursor.getAgent("agent-id");
console.log(agent.status);       // "queued" | "running" | "completed" | ...
console.log(agent.pullRequestUrl);
```

### `getConversation(id)` — `GET /v0/agents/{id}/conversation`

Retrieve the full conversation history for an agent.

```typescript
const { messages } = await cursor.getConversation("agent-id");
for (const msg of messages) {
  console.log(msg.role, msg.content); // "user" | "assistant"
}
```

### `followup(id, prompt)` — `POST /v0/agents/{id}/followup`

Send a followup instruction to a running agent.

```typescript
await cursor.followup("agent-id", "Also add unit tests for the new module");
```

### `stop(id)` — `POST /v0/agents/{id}/stop`

Stop a running agent.

```typescript
await cursor.stop("agent-id");
```

### `interrupt(agentId, prompt)` — composite

Stop the agent and then immediately send a new instruction. Guarantees that `stop` completes before `followup` is called.

```typescript
await cursor.interrupt("agent-id", "Focus on the auth module instead");
```

## Repo-Scoped Chain

For repeated operations on the same repository, use the chainable `.repo()` helper:

```typescript
const result = await cursor
  .repo("owner/repo")
  .branch("feature/dark-mode") // optional override
  .model("cursor-small")        // optional override
  .run("Add dark mode support and open a PR");

console.log(result.final.status);
console.log(result.final.pullRequestUrl);
```

The repo chain also exposes `.conversation(id)`, `.followup(id, prompt)`, `.stop(id)`, and `.interrupt(id, prompt)`.

## Polling Helpers

```typescript
// Poll until terminal status (completed / failed / cancelled / timeout)
const final = await cursor.wait("agent-id", {
  pollIntervalMs: 5_000,  // default 5s
  timeoutMs: 20 * 60_000, // default 20 min
  onPoll: (status) => console.log(status.status),
});

// Launch + wait in one call
const { agentId, final } = await cursor.run({
  prompt: "Fix the bug",
  repository: "owner/repo",
});
```

## Zod Schemas

All request/response shapes are exported as Zod schemas for use in your own validation:

```typescript
import { CreateAgentParamsSchema, GetConversationResponseSchema } from "@hardlydifficult/cursor-cloud";
```
