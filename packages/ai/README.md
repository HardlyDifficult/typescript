# @hardlydifficult/ai

Unified AI client with chainable structured output, callback-based streaming, tool-calling agents, required usage tracking, and response parsing utilities.

## Installation

```bash
npm install @hardlydifficult/ai
```

## Quick Start

```typescript
import { createAI, claude } from "@hardlydifficult/ai";
import { Logger, ConsolePlugin } from "@hardlydifficult/logger";

const logger = new Logger().use(new ConsolePlugin());
const tracker = {
  record(usage) {
    console.log(`Tokens: ${usage.inputTokens} in, ${usage.outputTokens} out`);
  },
};

const ai = createAI(claude("sonnet"), tracker, logger);

// Simple chat
const msg = await ai.chat("Explain closures");
console.log(msg.text);

// Structured output
const task = await ai.chat("Create a task").zod(TaskSchema);
console.log(task); // { title: "...", priority: "high" }

// Conversation
const reply = await msg.reply("Give me a TypeScript example");
console.log(reply.text);
```

## AI Client

### `createAI(model, tracker, logger, options?)`

Creates an AI client. Usage tracking and logging are **required** — every call automatically fires `tracker.record()` and logs via `logger`.

```typescript
import { createAI, claude } from "@hardlydifficult/ai";

const ai = createAI(claude("sonnet"), tracker, logger);
const ai = createAI(claude("sonnet"), tracker, logger, { maxTokens: 8192 });
```

**Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxTokens` | `number` | `4096` | Maximum output tokens per request |
| `temperature` | `number` | — | Sampling temperature (0–2) |

## Chat & Replies

### `chat(prompt, systemPrompt?)`

Send a prompt and get a rich response with usage info and conversation support.

```typescript
const msg = await ai.chat("Explain closures");
msg.text;  // "A closure is..."
msg.usage; // { inputTokens: 50, outputTokens: 200, durationMs: 1200, ... }

// With system prompt
const msg = await ai.chat("Explain closures", "You are a TypeScript tutor");
```

### `.text()` — String Shorthand

Get just the text without the full message object.

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

## Streaming

### `stream(messages, onText)`

Stream text deltas via callback. Returns accumulated text + usage when done.

```typescript
const result = await ai.stream(
  [{ role: "user", content: "Write a poem" }],
  (text) => process.stdout.write(text)
);
result.text;  // full accumulated text
result.usage; // { inputTokens, outputTokens, durationMs }
```

## Tool-Calling Agents

### `agent(tools, options?)`

Create a tool-calling agent. Tools are plain objects — no SDK imports needed. Tool calls and results are auto-logged via Logger.

```typescript
import type { ToolMap } from "@hardlydifficult/ai";
import { z } from "zod";

const tools: ToolMap = {
  read_file: {
    description: "Read a file",
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => fs.readFileSync(path, "utf-8"),
  },
  write_file: {
    description: "Write a file",
    inputSchema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path, content }) => {
      fs.writeFileSync(path, content);
      return "File written";
    },
  },
};

// Non-streaming
const result = await ai.agent(tools).run([
  { role: "user", content: "Read config.json and tell me the version" },
]);
console.log(result.text);

// Streaming with text callback
await ai.agent(tools).stream(
  [{ role: "user", content: "Create a new file" }],
  (text) => process.stdout.write(text)
);

// Streaming with tool call markers
await ai.agent(tools, { maxSteps: 20 }).stream(
  [{ role: "user", content: "Read and modify a file" }],
  {
    onText: (text) => process.stdout.write(text),
    onToolCall: (name, input) => console.log(`→ ${name}(${JSON.stringify(input)})`),
    onToolResult: (name, result) => console.log(`← ${result.slice(0, 50)}...`),
  }
);
```

**Agent Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxSteps` | `number` | `10` | Maximum tool-calling iterations |
| `temperature` | `number` | `0.7` | Sampling temperature |
| `maxTokens` | `number` | `4096` | Maximum output tokens |

## Model Helpers

### `claude(variant)`

Short names for Anthropic models. Uses auto-resolving aliases — always gets the latest snapshot.

```typescript
import { claude } from "@hardlydifficult/ai";

claude("sonnet"); // claude-sonnet-4-5
claude("haiku");  // claude-haiku-4-5
claude("opus");   // claude-opus-4-6
```

### `ollama(model)`

Ollama models. Names match whatever is installed locally. Includes extended timeouts for large model loading and keep-alive support.

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

**Usage Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `inputTokens` | `number` | Tokens in the prompt |
| `outputTokens` | `number` | Tokens in the response |
| `durationMs` | `number` | Request duration in milliseconds |
| `prompt` | `string` | Last user message |
| `response` | `string` | Full response text |
| `systemPrompt?` | `string` | System prompt (only for `chat()` calls) |

## Response Parsing

### `extractJson(text, sentinel?)`

Extract JSON from AI response text using a three-pass strategy: direct parse, code blocks, balanced braces.

```typescript
import { extractJson } from "@hardlydifficult/ai";

extractJson('Here is the result:\n```json\n{"key": "value"}\n```');
// [{ key: "value" }]

extractJson('The answer is {"a":1} in the text.');
// [{ a: 1 }]

// Sentinel: return empty if text contains the sentinel
extractJson('NO_FINDINGS: no issues detected', "NO_FINDINGS");
// []
```

### `extractTyped(text, schema, sentinel?)`

Extract and validate JSON against a schema. Works with any object that has a `safeParse` method (Zod, custom validators, etc.).

```typescript
import { extractTyped } from "@hardlydifficult/ai";
import { z } from "zod";

const Person = z.object({ name: z.string(), age: z.number() });

extractTyped('{"name": "Alice", "age": 30}', Person);
// [{ name: "Alice", age: 30 }]

extractTyped('Invalid: {"name": "Bob"}', Person);
// [] — age is missing, validation fails

extractTyped('{"name": "Charlie", "age": 25} NO_RESULTS', Person, "NO_RESULTS");
// [] — sentinel found
```

### `extractCodeBlock(text, lang?)`

Extract fenced code block contents, optionally filtered by language tag.

```typescript
import { extractCodeBlock } from "@hardlydifficult/ai";

extractCodeBlock('```json\n{"a":1}\n```\n```js\nconst x = 1;\n```');
// ['{"a":1}', 'const x = 1;']

extractCodeBlock('```json\n{"a":1}\n```\n```js\nconst x = 1;\n```', "json");
// ['{"a":1}']
```

### `extractTag(text, tagName)`

Extract content from XML-style tags. Useful for AI responses that wrap output in tags like `<result>...</result>`.

```typescript
import { extractTag } from "@hardlydifficult/ai";

const text = "Some thinking...<result>The answer is 42</result>";
extractTag(text, "result");
// "The answer is 42"

extractTag(text, "missing");
// null
```

## Multimodal Messages

### `extractTextContent(content)`

Extract plain text from multimodal content (string or content array).

```typescript
import { extractTextContent } from "@hardlydifficult/ai";

extractTextContent("plain text");
// "plain text"

extractTextContent([
  { type: "text", text: "Hello" },
  { type: "image", url: "..." },
  { type: "text", text: "World" },
]);
// "Hello\nWorld"
```

### `toPlainTextMessages(messages)`

Convert multimodal messages to plain text messages. Flattens any multimodal content arrays to plain text strings.

```typescript
import { toPlainTextMessages } from "@hardlydifficult/ai";

const messages = [
  {
    role: "user",
    content: [
      { type: "text", text: "Describe this" },
      { type: "image", url: "..." },
    ],
  },
];

const plain = toPlainTextMessages(messages);
// [{ role: "user", content: "Describe this" }]
```

## Types

All public types are exported for TypeScript integration:

```typescript
import type {
  AI,
  AITracker,
  AIOptions,
  Agent,
  AgentOptions,
  AgentResult,
  AgentCallbacks,
  ChatMessage,
  ChatCall,
  Message,
  ToolMap,
  ToolDefinition,
  Usage,
  MultimodalMessage,
  SchemaLike,
} from "@hardlydifficult/ai";
```