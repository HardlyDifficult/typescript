# @hardlydifficult/ai

Opinionated AI helpers for local tools and automations.

The package is optimized for the simple path:

- object config instead of positional setup
- `ask()` for text
- `askFor()` for structured output
- string shorthands for streaming and agents
- optional logger, required usage tracking

## Installation

```bash
npm install @hardlydifficult/ai
```

## Quick Start

```typescript
import { createAI, claude } from "@hardlydifficult/ai";
import type { AITracker } from "@hardlydifficult/ai";
import { z } from "zod";

const tracker: AITracker = {
  record(usage) {
    console.log(usage.inputTokens + usage.outputTokens);
  },
};

const ai = createAI({
  model: claude("sonnet"),
  tracker,
  systemPrompt: "Be concise. Prefer direct answers.",
});

const summary = await ai.ask("Summarize this diff");

const labels = await ai.askFor(
  "Classify this pull request",
  z.object({
    type: z.enum(["bugfix", "feature", "refactor"]),
    confidence: z.number(),
  })
);

await ai.stream("Draft the release note", (chunk) => {
  process.stdout.write(chunk);
});
```

## `createAI`

Preferred form:

```typescript
const ai = createAI({
  model: claude("sonnet"),
  tracker,
  logger,
  systemPrompt: "You are a careful coding assistant.",
  maxTokens: 8192,
  temperature: 0.2,
});
```

Config:

- `model`: AI SDK language model
- `tracker`: required usage tracker
- `logger`: optional, silent by default
- `systemPrompt`: default system prompt for `ask`, `askFor`, `stream`, and `agent`
- `maxTokens`: defaults to `4096`
- `temperature`: optional

The older positional form still works:

```typescript
const ai = createAI(claude("sonnet"), tracker, logger, {
  maxTokens: 8192,
  temperature: 0.2,
});
```

## `AI`

### `ask(prompt, options?)`

Use this for the common case.

```typescript
const answer = await ai.ask("What changed in this commit?");
```

### `askFor(prompt, schema, options?)`

Use this when you want validated structured output.

```typescript
const result = await ai.askFor(
  "Extract the repo name and branch",
  z.object({
    repo: z.string(),
    branch: z.string(),
  })
);
```

### `withSystemPrompt(systemPrompt)`

Create a scoped client without rebuilding the whole config.

```typescript
const reviewer = ai.withSystemPrompt("Review code for bugs and regressions.");
const review = await reviewer.ask("Review this patch");
```

### `chat(prompt, systemPrompt?)`

Use `chat()` when you want follow-up turns.

```typescript
const first = await ai.chat("Summarize the bug");
const second = await first.reply("Now propose a fix");
```

### `stream(input, onText, options?)`

`input` can be a plain string or a full `Message[]`.

```typescript
await ai.stream("Write the commit message", (chunk) => {
  process.stdout.write(chunk);
});
```

## Agents

Agents inherit the AI client's defaults and accept plain text prompts.

```typescript
const agent = ai.agent({
  readFile: {
    description: "Read a file from disk",
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => {
      return {
        path,
        contents: "file contents here",
      };
    },
  },
  listFiles: {
    description: "List files in a directory",
    inputSchema: z.object({ directory: z.string() }),
    execute: async ({ directory }) => ({ directory, files: ["src/index.ts"] }),
  },
});

const result = await agent.run("Inspect src/index.ts and explain it");
```

### `agent.run(input, options?)`

```typescript
const result = await agent.run("Find the bug");
console.log(result.text);
```

### `agent.stream(input, handler, options?)`

```typescript
await agent.stream("Refactor this module", {
  onText: (chunk) => process.stdout.write(chunk),
  onToolCall: (name, input) => console.log("tool", name, input),
  onToolResult: (name, result) => console.log("result", name, result),
});
```

Tool results can be strings or structured values. You do not need to stringify objects yourself.

## Prompt Loader

```typescript
import { createPromptLoader } from "@hardlydifficult/ai";

const loadReviewPrompt = createPromptLoader("prompts", "review.md");
const reviewPrompt = loadReviewPrompt();
```

## Providers

### `claude(variant)`

```typescript
const model = claude("sonnet");
```

Supported variants:

- `sonnet`
- `haiku`
- `opus`

### `ollama(model)`

```typescript
import { ollama } from "@hardlydifficult/ai";

const model = ollama("qwen3-coder-next:15b");
```

The Ollama helper keeps models warm and uses long HTTP timeouts so local models can take time to load without breaking requests.

## Extraction Utilities

```typescript
import {
  extractCodeBlock,
  extractJson,
  extractTag,
  extractTyped,
} from "@hardlydifficult/ai";
```

These are useful when you already have model output and want to recover structured data after the fact.
