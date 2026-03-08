# @hardlydifficult/agent-tools

A small wrapper around OpenCode for two things:

- running one agent task with a concise, stream-friendly API
- parsing GitHub-style file references into a shape that reads well in client code

## Installation

```bash
npm install @hardlydifficult/agent-tools
```

## Quick Start

```typescript
import {
  parseFileReference,
  runAgent,
} from "@hardlydifficult/agent-tools";

const file = parseFileReference("src/index.ts#L10-L20");
// { path: "src/index.ts", lines: { start: 10, end: 20 } }

const result = await runAgent({
  task: "Explain why the tests are failing.",
  directory: process.cwd(),
  model: "openai/o3",
  onEvent(event) {
    if (event.type === "text") {
      process.stdout.write(event.text);
    }
  },
});

console.log(result.output);
```

## `runAgent()`

`runAgent()` is the package's main entrypoint. It starts or reuses an OpenCode server, creates a session, sends one task, and streams back text/tool events through a single callback.

### `runAgent(options: RunAgentOptions): Promise<RunAgentResult>`

```typescript
import { runAgent } from "@hardlydifficult/agent-tools";

const result = await runAgent({
  task: "Review the latest diff and suggest one small cleanup.",
  directory: "/Users/nick/Documents/code/typescript",
  model: "o3",
  instructions: "Be concise and actionable.",
  mode: "read",
  onEvent(event) {
    switch (event.type) {
      case "text":
        process.stdout.write(event.text);
        break;
      case "tool-start":
        console.log(`\n[tool:start] ${event.tool}`);
        break;
      case "tool-finish":
        console.log(`\n[tool:end] ${event.tool} ok=${event.ok}`);
        break;
    }
  },
});

console.log(result.ok, result.output, result.error);
```

### Options

| Field | Type | Description |
|------|------|-------------|
| `task` | `string` | What the agent should do |
| `directory` | `string` | Working directory for the run |
| `model?` | `string` | `provider/model` or just `model` |
| `instructions?` | `string` | Extra top-level instructions |
| `mode?` | `"edit" \| "read"` | `read` restricts the run to read-only file tools |
| `signal?` | `AbortSignal` | Cancels the run |
| `onEvent?` | `(event) => void` | Receives streamed text and tool events |

### Model resolution

- If `model` is omitted, `OPENCODE_MODEL` is used.
- If `model` is just a model name such as `"o3"`, `OPENCODE_PROVIDER` is used when present.
- If `OPENCODE_PROVIDER` is not set, the provider defaults to `"anthropic"`.

### Result

| Field | Type | Description |
|------|------|-------------|
| `ok` | `boolean` | `true` when the run completed without a session error |
| `output` | `string` | Collected assistant text |
| `error?` | `string` | Session error message, when one occurred |
| `durationMs` | `number` | Total wall-clock duration |
| `sessionId` | `string` | OpenCode session identifier |

## `parseFileReference()`

Parses GitHub-style file references into a structured shape:

```typescript
import { parseFileReference } from "@hardlydifficult/agent-tools";

parseFileReference("src/index.ts");
// { path: "src/index.ts" }

parseFileReference("src/index.ts#L5");
// { path: "src/index.ts", lines: { start: 5, end: 5 } }

parseFileReference("src/index.ts#L15-L5");
// { path: "src/index.ts", lines: { start: 5, end: 15 } }

parseFileReference("src/index.ts#L0");
// { path: "src/index.ts#L0" }
```

## Shutdown

If you keep a worker process alive and want to clean up the shared OpenCode subprocess explicitly:

```typescript
import { shutdownAgentServer } from "@hardlydifficult/agent-tools";

shutdownAgentServer();
```
