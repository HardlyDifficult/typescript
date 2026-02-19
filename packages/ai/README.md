I'll analyze the package structure and source files to generate a comprehensive README.Now let me read the key implementation files:Now let me read the parsing utilities:Now let me check the test files for usage examples:Let me check a few more test files for additional examples:Now I have all the information I need. Let me generate the comprehensive README:

# @hardlydifficult/ai

Unified AI client with structured output, streaming, tool-calling agents, required usage tracking, and response parsing utilities.

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
const msg = await ai.chat("Explain closures in TypeScript");
console.log(msg.text);

// Structured output
const task = await ai.chat("Create a task").zod(z.object({
  title: z.string(),
  priority: z.enum(["high", "medium", "low"]),
}));
console.log(task); // { title: "...", priority: "high" }

// Conversation
const reply = await msg.reply("Give me an example");
console.log(reply.text);
```

## Core API

### `createAI(model, tracker, logger, options?)`

Creates an AI client. **Usage tracking and logging are required** — every call automatically fires `tracker.record()` and logs via `logger`.

```typescript
import { createAI, claude } from "@hardlydifficult/ai";

const ai = createAI(claude("sonnet"), tracker, logger, {
  maxTokens: 8192,
  temperature: 0.7,
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | `LanguageModel` | Yes | Language model from `claude()` or `ollama()` |
| `tracker` | `AITracker` | Yes | Object with `record(usage)` method |
| `logger` | `Logger` | Yes | Logger instance from `@hardlydifficult/logger` |
| `options` | `AIOptions` | No | `{ maxTokens?: number, temperature?: number }` |

**Returns:** `AI` client with `chat()`, `stream()`, and `agent()` methods.

### `chat(prompt, systemPrompt?)`

Send a prompt and get a rich response with usage info and conversation support.

```typescript
const msg = await ai.chat("Explain closures");
console.log(msg.text);        // "A closure is..."
console.log(msg.usage);       // { inputTokens: 50, outputTokens: 200, durationMs: 1200, ... }

// With system prompt
const msg = await ai.chat("Explain closures", "You are a TypeScript tutor");
```

**Returns:** `ChatMessage` with `.text`, `.usage`, and `.reply()` method.

### `.text()` — String Shorthand

Get just the text response without the full message object.

```typescript
const text = await ai.chat("Summarize this").text();
// → "The summary is..."
```

### `.zod(schema)` — Structured Output

Chain `.zod(schema)` to constrain the model's output format, validate the result, and get typed data. The schema does triple duty: constrains output, validates response, provides TypeScript types.

```typescript
import { z } from "zod";

const TaskSchema = z.object({
  title: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  dueDate: z.string().optional(),
});

const task = await ai.chat("Create a task for fixing the login bug").zod(TaskSchema);
// { title: "Fix login bug", priority: "high", dueDate: undefined }
// Type: z.infer<typeof TaskSchema>
```

### `.reply(prompt)` — Conversation

Continue a conversation. Message history accumulates automatically.

```typescript
const msg1 = await ai.chat("What is a monad?");
const msg2 = await msg1.reply("Give me a TypeScript example");
const msg3 = await msg2.reply("Now formalize it").zod(DefinitionSchema);

// msg3 has full conversation history in context
```

### `stream(messages, onText)` — Callback-Based Streaming

Stream text deltas via callback. Returns accumulated text + usage when done.

```typescript
const result = await ai.stream(
  [{ role: "user", content: "Write a poem" }],
  (text) => process.stdout.write(text)
);

console.log(result.text);  // full accumulated text
console.log(result.usage); // { inputTokens, outputTokens, durationMs }
```

### `agent(tools, options?)` — Tool-Calling Agent

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
  { role: "user", content: "Read src/index.ts and summarize it" }
]);
console.log(result.text);

// Streaming with function shorthand
await ai.agent(tools).stream(
  [{ role: "user", content: "Create a new file" }],
  (text) => process.stdout.write(text)
);

// Streaming with callbacks
await ai.agent(tools, { maxSteps: 20 }).stream(
  [{ role: "user", content: "Analyze the codebase" }],
  {
    onText: (text) => process.stdout.write(text),
    onToolCall: (name, input) => console.log(`Using tool: ${name}`, input),
    onToolResult: (name, result) => console.log(`Tool result:`, result),
  }
);
```

**Agent Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSteps` | `number` | 10 | Maximum tool-calling iterations |
| `temperature` | `number` | 0.7 | Sampling temperature |
| `maxTokens` | `number` | 4096 | Max output tokens |

## Model Helpers

### `claude(variant)`

Short names for Anthropic Claude models. Uses auto-resolving aliases — always gets the latest snapshot.

```typescript
import { claude } from "@hardlydifficult/ai";

claude("sonnet");  // claude-sonnet-4-5
claude("haiku");   // claude-haiku-4-5
claude("opus");    // claude-opus-4-6
```

### `ollama(model)`

Ollama models. Names match whatever is installed locally. Includes extended timeouts for large model loading and keep-alive support.

```typescript
import { ollama } from "@hardlydifficult/ai";

ollama("qwen3-coder-next:latest");
ollama("llama3.3");
ollama("mistral");
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
| `inputTokens` | `number` | Input token count |
| `outputTokens` | `number` | Output token count |
| `durationMs` | `number` | Request duration in milliseconds |
| `prompt` | `string` | Last user message |
| `response` | `string` | Full response text |
| `systemPrompt?` | `string` | System prompt (only for `chat()` calls) |

## Response Parsing

### `extractJson(text, sentinel?)`

Extract JSON from AI response text using a three-pass strategy: direct parse, code blocks, balanced braces.

```typescript
import { extractJson } from "@hardlydifficult/ai";

// Direct parse
extractJson('{"key": "value"}');
// [{ key: "value" }]

// From code block
extractJson('Here is the result:\n```json\n{"key": "value"}\n```');
// [{ key: "value" }]

// From prose
extractJson('The answer is {"key": "value"} as shown above.');
// [{ key: "value" }]

// Multiple results
extractJson('First {"a":1} then {"b":2}');
// [{ a: 1 }, { b: 2 }]

// With sentinel (returns empty if found)
extractJson('NO_FINDINGS: no issues detected', "NO_FINDINGS");
// []
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to extract JSON from |
| `sentinel?` | `string` | If present in text, return empty array |

**Returns:** `unknown[]` — array of parsed JSON values.

### `extractTyped(text, schema, sentinel?)`

Extract and validate JSON against a schema. Works with any object that has a `safeParse` method (Zod, custom validators, etc).

```typescript
import { extractTyped } from "@hardlydifficult/ai";
import { z } from "zod";

const Person = z.object({ name: z.string(), age: z.number() });

// Valid match
extractTyped('{"name": "Alice", "age": 30}', Person);
// [{ name: "Alice", age: 30 }]

// From code block
extractTyped('```json\n{"name": "Bob", "age": 25}\n```', Person);
// [{ name: "Bob", age: 25 }]

// Invalid data filtered out
extractTyped('{"name": "Carol", "age": "not a number"}', Person);
// [] — validation failed

// Multiple results, only valid ones returned
extractTyped('```json\n{"name":"Alice","age":30}\n```\n```json\n{"bad":"data"}\n```', Person);
// [{ name: "Alice", age: 30 }]

// With sentinel
extractTyped('NO_FINDINGS {"name": "Alice", "age": 30}', Person, "NO_FINDINGS");
// []
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to extract JSON from |
| `schema` | `SchemaLike<T>` | Schema with `safeParse(data)` method |
| `sentinel?` | `string` | If present in text, return empty array |

**Returns:** `T[]` — array of validated results.

### `extractCodeBlock(text, lang?)`

Extract fenced code block contents, optionally filtered by language tag.

```typescript
import { extractCodeBlock } from "@hardlydifficult/ai";

// All code blocks
extractCodeBlock('```js\nconsole.log("hi");\n```\n```ts\nconst x = 1;\n```');
// ['console.log("hi");', 'const x = 1;']

// Filtered by language
extractCodeBlock('```json\n{"a":1}\n```\n```ts\nconst x = 1;\n```', "json");
// ['{"a":1}']

// Case-insensitive
extractCodeBlock('```JSON\n{"a":1}\n```', "json");
// ['{"a":1}']

// Untagged blocks
extractCodeBlock('```\nhello world\n```');
// ['hello world']
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text containing code blocks |
| `lang?` | `string` | Optional language tag filter (case-insensitive) |

**Returns:** `string[]` — array of code block contents.

### `extractTextContent(content)`

Extract plain text from multimodal content (string or content array).

```typescript
import { extractTextContent } from "@hardlydifficult/ai";

// String content
extractTextContent("Hello world");
// "Hello world"

// Multimodal content array
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
      { type: "text", text: "Analyze this" },
      { type: "image", url: "..." },
    ],
  },
  {
    role: "assistant",
    content: "I see an image",
  },
];

toPlainTextMessages(messages);
// [
//   { role: "user", content: "Analyze this" },
//   { role: "assistant", content: "I see an image" },
// ]
```

## Types

### `AITracker`

```typescript
interface AITracker {
  record(usage: Usage): void;
}
```

### `Usage`

```typescript
interface Usage {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  prompt: string;
  response: string;
  systemPrompt?: string;
}
```

### `ToolMap`

```typescript
type ToolMap = Record<string, ToolDefinition>;

interface ToolDefinition<TInput extends z.ZodType = z.ZodType> {
  description: string;
  inputSchema: TInput;
  execute: (input: z.infer<TInput>) => Promise<string>;
}
```

### `Message`

```typescript
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}
```

### `ChatMessage`

```typescript
interface ChatMessage {
  text: string;
  usage: Usage;
  reply(prompt: string): ChatCall;
}
```

### `ChatCall`

```typescript
interface ChatCall extends PromiseLike<ChatMessage> {
  text(): PromiseLike<string>;
  zod<TSchema extends z.ZodType>(schema: TSchema): PromiseLike<z.infer<TSchema>>;
}
```

### `Agent`

```typescript
interface Agent {
  run(messages: Message[]): Promise<AgentResult>;
  stream(
    messages: Message[],
    handler: ((text: string) => void) | AgentCallbacks
  ): Promise<AgentResult>;
}
```

### `AgentCallbacks`

```typescript
interface AgentCallbacks {
  onText: (text: string) => void;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string) => void;
}
```

### `AgentResult`

```typescript
interface AgentResult {
  text: string;
  usage: Usage;
}
```

## Design Principles

- **Required Tracking**: Every AI call must be tracked. No silent usage