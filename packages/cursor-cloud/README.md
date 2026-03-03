# @hardlydifficult/cursor-cloud

Focused, Cursor-only client for launching and tracking Cursor Cloud remote agent sessions.

## Installation

```bash
npm install @hardlydifficult/cursor-cloud
```

## Quick Start

```typescript
import { createCursorCloud } from "@hardlydifficult/cursor-cloud";

// Reads CURSOR_API_KEY from env by default.
const cursor = createCursorCloud();
// Optional override:
// const cursor = createCursorCloud({ apiKey: process.env.CURSOR_API_KEY });

const result = await cursor
  .repo("owner/repo")
  .branch("main")
  .run("Fix the failing CI test and open a PR");

console.log(result.final.status);
console.log(result.final.pullRequestUrl);
```

## API

### `createCursorCloud(options?)`

Creates a client with opinionated defaults:

- `baseUrl`: `https://api.cursor.com`
- `pollIntervalMs`: `5000`
- `timeoutMs`: `20 minutes`
- repo branch default: `main`

### `client.repo(repository)`

Starts a chain scoped to one repository.

- `.branch(name)` -> returns a new chain with a branch override
- `.model(name)` -> returns a new chain with a model override
- `.launch(prompt)` -> creates an agent session
- `.wait(agentId)` -> polls status until terminal or timeout
- `.run(prompt)` -> launch + wait convenience method
