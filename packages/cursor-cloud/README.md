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

// Or pass options explicitly:
const cursor = createCursorCloud({
  apiKey: "your-api-key",
  baseUrl: "https://api.cursor.com", // optional
  webhook: {
    url: "https://example.com/webhook", // optional default for all sessions
    secret: "shared-secret", // optional
  },
});
```

Authentication uses **HTTP Basic auth** — the API key is sent as the username with an empty password.

## Fluent API

```typescript
const agent = cursor.select("owner/repo", "main", "cursor-small");
const session = agent.prompt("hi");
session.reply("tell me more").reply("keep going");
const final = await session;
```

- `select(repo, branch?, model?)` scopes repo/branch/model.
- `prompt(message)` launches a session.
- `reply(message)` is chainable and sends followups.
- `session` is thenable/promisable (`await session` or `session.then(...)`).

### `listAgents(options?)` — `GET /v0/agents`

List agents with optional filters and pagination.

By default, archived agents are hidden to match Cursor's browser view. To include archived agents, pass `includeArchived: true` or filter explicitly with `status: "archived"`.

```typescript
const list = await cursor.listAgents({
  repo: "owner/repo",
  status: "running",
  limit: 20,
  offset: 0,
});

console.log(list.agents, list.total, list.hasMore);

const archived = await cursor.listAgents({
  status: "archived",
});

const allIncludingArchived = await cursor.listAgents({
  includeArchived: true,
});
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

`session.stop()` and `session.interrupt(message)` are also available when needed.

## Polling Helpers

```typescript
// Poll by id when needed (completed / failed / cancelled / timeout)
const final = await cursor.waitForAgent("agent-id", {
  pollIntervalMs: 5_000,  // default 5s
  timeoutMs: 20 * 60_000, // default 20 min
  onPoll: (status) => console.log(status.status),
});
```

## Zod Schemas

All request/response shapes are exported as Zod schemas for use in your own validation:

```typescript
import { LaunchCursorAgentInputSchema, GetConversationResponseSchema } from "@hardlydifficult/cursor-cloud";
```
