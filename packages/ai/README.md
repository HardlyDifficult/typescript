# @hardlydifficult/ai

Unified AI client with chainable structured output, callback-based streaming, tool-calling agent, required usage tracking, and response parsing utilities.

## Installation

```bash
npm install @hardlydifficult/ai
```

## AI Client

### `createAI(model, tracker, logger, options?)`

Creates an AI client. Usage tracking and logging are **required** — every call automatically fires `tracker.record()` and logs via `logger`.

```typescript
import { createAI, claude, ollama } from "@hardlydifficult/ai";
import { Logger, ConsolePlugin } from "@hardlydifficult/logger";

const logger = new Logger().use(new ConsolePlugin());
const ai = createAI(claude("sonnet"), tracker, logger);
```

Options: `{ maxTokens?: number, temperature?: number }`. Per-request AI instances are free — `createAI()` is a closure factory with zero async overhead.

### `chat(prompt, systemPrompt?)`

Send a prompt and get a rich response with usage info and conversation support.

```typescript
const msg = await ai.chat("Explain closures");
msg.text;  // "A closure is..."
msg.usage; // { inputTokens: 50, outputTokens: 200, durationMs: 1200, prompt: "Explain closures", response: "A closure is..." }

// With system prompt
const msg = await ai.chat("Explain closures", "You are a TypeScript tutor");
```

### `.text()` — String Shorthand

```typescript
const text = await ai.chat("Summarize this").text(); // → string
```

### `.zod(schema)` — Structured Output

Chain `.zod(schema)` to constrain the model's output format AND validate the result. The schema does triple duty: constrains output, validates response, provides TypeScript types.

```typescript
import { z } from "zod";

const TaskSchema = z.object({
  title: z.string(),
  priority: z.enum(["high", "medium", "low"]),
});

const data = await ai.chat("Create a task for fixing the login bug").zod(TaskSchema);
// { title: "Fix login bug", priority: "high" } — typed as z.infer<typeof TaskSchema>
```

### `.reply(prompt)` — Conversation

Continue a conversation. Message history accumulates automatically.

```typescript
const msg1 = await ai.chat("What is a monad?");
const msg2 = await msg1.reply("Give me a TypeScript example");
const msg3 = await msg2.reply("Now formalize it").zod(DefinitionSchema);
```

### `stream(messages, onText)` — Callback-Based Streaming

Stream text deltas via callback. Returns accumulated text + usage when done.

```typescript
const result = await ai.stream(messages, (text) => process.stdout.write(text));
result.text;  // full accumulated text
result.usage; // { inputTokens, outputTokens, durationMs }
```

### `agent(tools, options?)` — Tool-Calling Agent

Create a tool-calling agent. Tools are plain objects — no SDK imports needed. Tool calls and results are auto-logged via Logger.

```typescript
import type { ToolMap } from "@hardlydifficult/ai";

const tools: ToolMap = {
  read_file: {
    description: "Read a file",
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => fs.readFileSync(path, "utf-8"),
  },
};

// Non-streaming
const result = await ai.agent(tools).run(messages);

// Streaming — function shorthand
await ai.agent(tools).stream(messages, (text) => process.stdout.write(text));

// Streaming — with tool call markers
await ai.agent(tools, { maxSteps: 20 }).stream(messages, {
  onText: (text) => process.stdout.write(text),
  onToolCall: (name) => console.log(`Using tool: ${name}`),
});
```

Agent options: `{ maxSteps?: number (default 10), temperature?: number (default 0.7), maxTokens?: number (default 4096) }`.

## Model Helpers

### `claude(variant)`

Short names for Anthropic models. Uses auto-resolving aliases — always gets the latest snapshot.

```typescript
import { claude } from "@hardlydifficult/ai";

claude("sonnet"); // claude-sonnet-4-5 → latest snapshot
claude("haiku");  // claude-haiku-4-5
claude("opus");   // claude-opus-4-6
```

### `ollama(model)`

Ollama models. Names match whatever is installed locally.

```typescript
import { ollama } from "@hardlydifficult/ai";

ollama("qwen3-coder-next:latest");
ollama("llama3.3");
```

## Usage Tracking

`createAI` requires an `AITracker` — no AI without tracking. The tracker fires for every call (`chat`, `reply`, `zod`, `stream`, `agent`). Usage includes prompt/response content alongside token counts.

```typescript
import type { AITracker } from "@hardlydifficult/ai";

const tracker: AITracker = {
  record({ inputTokens, outputTokens, durationMs, prompt, response, systemPrompt }) {
    const cost = inputTokens * 3 / 1_000_000 + outputTokens * 15 / 1_000_000;
    console.log(`Cost: $${cost.toFixed(4)} | Prompt: ${prompt}`);
  },
};

const ai = createAI(claude("sonnet"), tracker, logger);
```

`Usage` fields: `inputTokens`, `outputTokens`, `durationMs`, `prompt` (last user message), `response` (full response text), and `systemPrompt?` (only set for `chat()` calls).

## Response Parsing

### `extractJson(text, sentinel?)`

Extract JSON from AI response text using a three-pass strategy: direct parse, code blocks, balanced braces.

```typescript
import { extractJson } from "@hardlydifficult/ai";

extractJson('Here is the result:\n```json\n{"key": "value"}\n```');
// [{ key: "value" }]
```

### `extractTyped(text, schema, sentinel?)`

Extract and validate JSON against a schema. Works with any object that has a `safeParse` method.

```typescript
import { extractTyped } from "@hardlydifficult/ai";

const Person = z.object({ name: z.string(), age: z.number() });
extractTyped('{"name": "Alice", "age": 30}', Person);
// [{ name: "Alice", age: 30 }]
```

### `extractCodeBlock(text, lang?)`

Extract fenced code block contents, optionally filtered by language tag.

### `extractTextContent(content)`

Extract plain text from multimodal content (string or content array).

### `toPlainTextMessages(messages)`

Convert multimodal messages to plain text messages.
