# @hardlydifficult/ai

Unified AI client with chainable structured output, streaming, tool-calling agents, and response utilities.

## Installation

```bash
npm install @hardlydifficult/ai
```

## Quick Start

```typescript
import { createAI, claude, ollama, createPromptLoader } from "@hardlydifficult/ai";
import type { AITracker } from "@hardlydifficult/ai";
import { z } from "zod";

// Create an Anthropic model from a short variant name
const model = claude("sonnet");

// Example tracker implementation
const tracker: AITracker = {
  record(usage) {
    console.log("Tokens used:", usage.inputTokens + usage.outputTokens);
  },
};

// Create the AI client
const ai = createAI(model, tracker, console);

// Chat with structured output
const data = await ai.chat("What is the capital of France?").zod(
  z.object({ city: z.string(), country: z.string() })
);

// Stream a response
await ai.stream([{ role: "user", content: "Explain quantum physics" }], (chunk) => {
  process.stdout.write(chunk);
});

// Use tool-calling agents
const agent = ai.agent({
  readFile: {
    description: "Read a file from disk",
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => `Contents of ${path}`,
  },
});

const result = await agent.run([{ role: "user", content: "Read src/index.ts" }]);
```

## AI Client

Creates an AI client with chat, streaming, and agent support, integrating usage tracking and logging.

### `createAI(model, tracker, logger, options?)`

Creates an AI client bound to a specific language model.

| Parameter | Type | Description |
|-----------|------|-------------|
| model | `LanguageModel` | AI SDK language model instance |
| tracker | `AITracker` | Usage tracking implementation |
| logger | `Logger` | Logging implementation |
| options?.maxTokens | `number` | Maximum output tokens (default: 4096) |
| options?.temperature | `number` | Temperature for generation (default: undefined) |

```typescript
import { createAI, claude } from "@hardlydifficult/ai";
import type { AITracker } from "@hardlydifficult/ai";
import { createTracker, createLogger } from "@hardlydifficult/logger";

const model = claude("sonnet");
const tracker = createTracker();
const logger = createLogger({ name: "ai" });

const ai = createAI(model, tracker, logger, {
  maxTokens: 8192,
  temperature: 0.7,
});
```

### `AI.chat(prompt, systemPrompt?)`

Initiates a chat conversation with an optional system prompt.

```typescript
const ai = createAI(model, tracker, console);

// Basic chat
const msg = await ai.chat("Hello, world!");

// With structured output
const data = await ai.chat("Extract user data").zod(
  z.object({ name: z.string(), age: z.number() })
);

// Chain reply
const reply = await msg.reply("Follow up question");
```

### `AI.stream(messages, onText)`

Streams a response token-by-token.

| Parameter | Type | Description |
|-----------|------|-------------|
| messages | `Message[]` | Message history |
| onText | `(text: string) => void` | Callback for each text chunk |

```typescript
await ai.stream(
  [{ role: "user", content: "Write a haiku" }],
  (chunk) => process.stdout.write(chunk)
);
```

### `AI.agent(tools, options?)`

Creates a tool-calling agent.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| maxSteps | `number` | 10 | Maximum tool-calling iterations |
| temperature | `number` | 0.7 | Model temperature |
| maxOutputTokens | `number` | 4096 | Max tokens to generate |

```typescript
const agent = ai.agent(
  {
    search: {
      description: "Search the web",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => `Results for ${query}`,
    },
    calculate: {
      description: "Perform a calculation",
      inputSchema: z.object({ expr: z.string() }),
      execute: async ({ expr }) => `Result: ${eval(expr)}`,
    },
  },
  { maxSteps: 5 }
);

const result = await agent.run([{ role: "user", content: "Search for AI news" }]);
```

#### Agent Streaming

```typescript
await agent.stream(
  [{ role: "user", content: "Calculate 123 * 456" }],
  {
    onText: (text) => process.stdout.write(text),
    onToolCall: (name, args) => console.log(`Calling ${name} with`, args),
    onToolResult: (name, result) => console.log(`${name} returned`, result)
  }
);
```

### `createPromptLoader(directory, filename)`

Loads prompt files from disk with caching.

```typescript
import { createPromptLoader } from "@hardlydifficult/ai";

const load = createPromptLoader("prompts", "system.md");

const systemPrompt = load(); // Returns file contents
```

## Core Factory

### `createAI`

Creates a unified AI client with chat, streaming, and structured output support.

```typescript
import { createAI } from '@hardlydifficult/ai';

const ai = createAI({
  provider: 'anthropic', // or 'ollama'
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseUrl: 'http://localhost:11434', // for Ollama
});

const reply = await ai.chat([
  { role: 'user', content: [{ type: 'text', text: 'Explain the capital of France.' }] }
]);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `'anthropic' \| 'ollama'` | — | LLM provider |
| `model` | `string` | — | Model name (e.g., `"claude-3-5-sonnet-20241022"` or `"llama3"`) |
| `apiKey` | `string` | — | API key (required for Anthropic) |
| `baseUrl` | `string` | — | Base URL (required for Ollama) |
| `logFn` | `(msg: string) => void` | `console.log` | Custom logging function |

---

## Agents

### `createAgent`

Creates an agent with tool-calling, streaming, and usage tracking.

```typescript
import { createAgent } from '@hardlydifficult/ai';

const multiply = {
  name: 'multiply',
  description: 'Multiply two numbers',
  parameters: z.object({ a: z.number(), b: z.number() })
};

const agent = createAgent({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  tools: { multiply },
  toolMiddleware: [{ onCall: () => console.log('Calling tool') }]
});

const result = await agent.run([
  { role: 'user', content: [{ type: 'text', text: 'What is 7 × 6?' }] }
]);

console.log(result.content); // 42
```

### `run` vs `stream`

| Method | Type | Description |
|--------|------|-------------|
| `agent.run(messages)` | `Promise<Reply>` | Full response as structured output |
| `agent.stream(messages)` | `AsyncIterable<string>` | Token-by-token text stream |

```typescript
const stream = agent.stream([
  { role: 'user', content: [{ type: 'text', text: 'Count to 5' }] }
]);

for await (const token of stream) {
  process.stdout.write(token); // 12345
}
```

---

## Tools

### `toolSchema`

Extracts tool schemas (name, description, parameters) for documentation.

```typescript
import { toolSchema } from '@hardlydifficult/ai';

const schema = toolSchema({
  multiply: {
    name: 'multiply',
    description: 'Multiply two numbers',
    parameters: z.object({ a: z.number(), b: z.number() })
  }
});

console.log(schema);
// [
//   {
//     name: "multiply",
//     description: "Multiply two numbers",
//     parameters: { type: "object", properties: { a: ..., b: ... } }
//   }
// ]
```

### `toolOverrides`

Dynamically override tool and parameter descriptions at runtime.

```typescript
const overridden = toolOverrides({
  multiply: {
    name: 'multiply',
    description: 'Override: Multiply two numbers',
    parameters: {
      a: { description: 'First factor' },
      b: { description: 'Second factor' }
    }
  }
});

// Use with createAgent
const agent = createAgent({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  tools: { multiply: z.object({ a: z.number(), b: z.number() }) },
  toolMiddleware: [],
  toolDescriptions: overridden
});
```

### `toolMiddleware`

Wrap tool calls with logging/metrics hooks.

```typescript
const loggingMiddleware = {
  onCall: (toolName: string, args: unknown) =>
    console.log(`Starting tool: ${toolName} with args`, args),
  onComplete: (toolName: string, result: unknown) =>
    console.log(`Tool ${toolName} completed with`, result)
};

const agent = createAgent({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  tools: { multiply },
  toolMiddleware: [loggingMiddleware]
});
```

---

## Extraction Utilities

### `extractJson`

Parses JSON from arbitrary text using multiple strategies.

```typescript
import { extractJson } from '@hardlydifficult/ai';

const input = 'Here is the data: ```json\n{"name":"Alice","age":30}\n```';

const result = extractJson(input);
console.log(result); // { name: 'Alice', age: 30 }
```

### `extractCodeBlock`

Extracts fenced code blocks optionally filtered by language.

```typescript
import { extractCodeBlock } from '@hardlydifficult/ai';

const input = 'Here is the JSON:\n```json\n{"a": 1}\n```\nAnd more text';

console.log(extractCodeBlock(input, 'json')); // { a: 1 }
console.log(extractCodeBlock(input)); // {"a": 1}
```

### `extractTag`

Extracts content between XML-style tags.

```typescript
import { extractTag } from '@hardlydifficult/ai';

const input = '<response>The answer is <value>42</value></response>';

console.log(extractTag(input, 'value')); // "42"
```

### `extractTyped`

Extracts and validates JSON using a Zod schema-like interface.

```typescript
import { extractTyped } from '@hardlydifficult/ai';
import { z } from 'zod';

interface Person {
  name: string;
  age: number;
}

const input = 'The person is { "name": "Alice", "age": 30 }';

const result = extractTyped<Person>(input, z.object({
  name: z.string(),
  age: z.number()
}));

console.log(result); // { name: "Alice", age: 30 }
```

---

## Message Utilities

### `multimodal` types

Support for text + image (e.g., Anthropic-style) content.

```typescript
import { toText } from '@hardlydifficult/ai/multimodal';

const message = {
  role: 'user',
  content: [
    { type: 'text', text: 'What is in this image?' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KG...' } }
  ]
};

console.log(toText(message)); // "What is in this image? [Image]"
```

### `AgentConversation`

Manages multi-turn chat history with pluggable `send` function.

```typescript
import { AgentConversation } from '@hardlydifficult/ai';

const conversation = new AgentConversation(async (messages) => {
  const reply = await ai.chat(messages);
  return reply;
});

await conversation.send([
  { role: 'user', content: [{ type: 'text', text: 'What is the capital of Japan?' }] }
]);
console.log(conversation.messages);
// [
//   { role: 'user', content: [{ type: 'text', text: 'What is the capital of Japan?' }] },
//   { role: 'assistant', content: [{ type: 'text', text: 'Tokyo' }] }
// ]
```

---

## Prompt Loading

### `createPromptLoader`

Lazy loads prompt templates from markdown files with caching.

```typescript
import { createPromptLoader } from '@hardlydifficult/ai';

const loadPrompt = createPromptLoader('./prompts');

const systemPrompt = await loadPrompt('analysis.md');
console.log(systemPrompt);
// "You are an expert analyst..."
```

---

## Provider Helpers

### `claude`

Convenience factory for Anthropic models.

```typescript
import { claude } from '@hardlydifficult/ai';

const model = claude('claude-3-5-sonnet-20241022', process.env.ANTHROPIC_API_KEY!);
```

### `ollama`

Extended Ollama provider with custom HTTP timeouts.

```typescript
import { ollama } from '@hardlydifficult/ai';

const model = ollama({
  model: 'llama3',
  baseUrl: 'http://localhost:11434',
  timeout: 60_000,
  keepAlive: '5m'
});
```

---

## Streaming

### `createStream`

Streams AI responses and records usage metrics.

```typescript
import { createStream } from '@hardlydifficult/ai';

const tracker = {
  record: (usage: { prompt_tokens: number; completion_tokens: number }) =>
    console.log('Usage:', usage)
};

const stream = await createStream({
  model,
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello!' }] }],
  tracker
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

---

## Utility Functions

### `findBalanced`

Extracts balanced delimiters (e.g., `{...}`, `[...]`).

```typescript
import { findBalancedBraces } from '@hardlydifficult/ai';

const text = '{ "a": 1, "b": { "c": 2 } } is valid';
const result = findBalancedBraces(text, 0);
console.log(result); // { start: 0, end: 32 }
```

### `addCacheControl`

Adds Anthropic cache control directives.

```typescript
import { addCacheControl } from '@hardlydifficult/ai';

const messages = [
  { role: 'system', content: [{ type: 'text', text: 'You are helpful.' }] },
  { role: 'user', content: [{ type: 'text', text: 'Question...' }] },
  { role: 'assistant', content: [{ type: 'text', text: 'Answer...' }] },
  { role: 'user', content: [{ type: 'text', text: 'New question...' }] }
];

addCacheControl(messages);
// Adds cacheControl: { type: 'ephemeral' } to system + second-to-last message
```

---

## LLM Providers

### `claude(variant)`

Creates an Anthropic language model from a short variant name.

```typescript
import { claude } from "@hardlydifficult/ai";

const sonnet = claude("sonnet"); // claude-sonnet-4-5
const haiku = claude("haiku");   // claude-haiku-4-5
const opus = claude("opus");     // claude-opus-4-6
```

### `ollama(model)`

Creates an Ollama language model with extended HTTP timeouts and `keep_alive: -1` support.

```typescript
import { ollama } from "@hardlydifficult/ai";

const model = ollama("llama3"); // Uses installed local model
const qwen = ollama("qwen3-coder-next:15b");
```

The `ollama` function uses a custom agent with 60-minute headersTimeout and 30-minute bodyTimeout to accommodate long model load times, and injects `keep_alive: -1` to prevent GPU memory eviction.

## Agents

### `AgentConversation`

Maintains a multi-turn conversation with an AI model.

```typescript
import { AgentConversation } from "@hardlydifficult/ai";

const sendFn = async (messages: Message[]): Promise<string> => {
  const lastUser = messages.filter(m => m.role === "user").pop();
  return lastUser ? `Echo: ${lastUser.content}` : "";
};

const conversation = new AgentConversation(sendFn, {
  systemPrompt: "You are a helpful assistant.",
});

const response1 = await conversation.send("Hello");
const response2 = await conversation.send("How are you?");
const history = conversation.getHistory(); // Full conversation
```

### `createAgent(model, tools, tracker, logger, options?)`

Creates an agent with tool-calling, streaming, and usage tracking.

```typescript
import { createAgent } from "@hardlydifficult/ai";

const agent = createAgent(
  model,
  {
    calculate: {
      description: "Perform a calculation",
      inputSchema: z.object({ expression: z.string() }),
      execute: async ({ expression }) => `Result: ${expression}`,
    },
  },
  tracker,
  console
);

// Run agent (non-streaming)
const result = await agent.run([
  { role: "user", content: "Calculate 2+2" },
]);

// Stream agent
await agent.stream(
  [{ role: "user", content: "Tell a joke" }],
  { onText: (t) => console.log(t) }
);
```

## Streaming

### `runStream(model, tracker, logger, messages, onText, maxTokens, temperature?)`

Streams a response token-by-token and records usage.

```typescript
import { runStream } from "@hardlydifficult/ai";

await runStream(
  model,
  tracker,
  console,
  [{ role: "user", content: "Hello" }],
  (text) => process.stdout.write(text),
  4096, // maxTokens
  0.7   // temperature
);
```

## Message Operations

### `extractJson(text, sentinel?)`

Extracts JSON values from text using progressive strategies: direct parse, code blocks, then balanced-brace scanning.

```typescript
import { extractJson } from "@hardlydifficult/ai";

const text = 'Result: {"name":"Alice"} in prose';
const results = extractJson(text); // [{ name: "Alice" }]

// Extract from code blocks
const codeResult = extractJson("```json\n{\"a\":1}\n```"); // [{ a: 1 }]
```

### `extractTyped(text, schema, sentinel?)`

Extracts and validates typed JSON objects from text using a schema-like interface.

```typescript
import { extractTyped } from "@hardlydifficult/ai";
import { z } from "zod";

const text = '{"name":"Alice","age":30}';
const results = extractTyped(text, z.object({ name: z.string(), age: z.number() }));
// [{ name: "Alice", age: 30 }]
```

### `extractCodeBlock(text, lang?)`

Extracts fenced code blocks from text, optionally filtered by language tag.

```typescript
import { extractCodeBlock } from "@hardlydifficult/ai";

const text = "```ts\nconst x = 1;\n```\n```json\n{\"a\":1}\n```";
const tsCode = extractCodeBlock(text, "ts"); // ["const x = 1;"]
const jsonCode = extractCodeBlock(text, "json"); // ['{"a":1}']
```

### `extractStructured(text, schema, sentinel?)`

Extracts and validates structured data using a schema-like interface.

```typescript
import { extractStructured } from "@hardlydifficult/ai";
import { z } from "zod";

const text = '{"name":"Alice","age":30}';
const results = extractStructured(text, z.object({ name: z.string(), age: z.number() }));
// [{ name: "Alice", age: 30 }]
```

## Response Utilities

### `Message`

Represents a chat message with methods for extracting structured data.

```typescript
import { Message } from "@hardlydifficult/ai";

const msg = new Message("Hello", 10, 5);

const text = msg.text(); // "Hello"
const json = msg.json(); // Attempts to parse as JSON
const zodData = msg.zod(z.object({ foo: z.string() })); // Validates with Zod
```

### `Message.reply(prompt)`

Appends a follow-up message to the conversation history.

```typescript
const msg = await ai.chat("What is TypeScript?");
const reply = await msg.reply("Explain the benefits");
```

## Multimodal Support

### `toPlainTextMessages(messages)`

Converts multimodal messages to plain text for compatibility.

```typescript
import { toPlainTextMessages } from "@hardlydifficult/ai";

const messages = [
  {
    role: "user",
    content: [
      { type: "text", text: "What's in this image?" },
      { type: "image", image: dataUrl }
    ]
  }
];

const plain = toPlainTextMessages(messages);
// [{ role: "user", content: "What's in this image?" }]
```

### `extractTextContent(content)`

Extracts text from multimodal content arrays.

```typescript
import { extractTextContent } from "@hardlydifficult/ai";

const content = [
  { type: "text", text: "First" },
  { type: "image" },
  { type: "text", text: "Second" }
];

const text = extractTextContent(content);
// "First\nSecond"
```

## Usage Tracking

The package integrates with `@hardlydifficult/logger` to track AI usage.

```typescript
import { createTracker, type Usage } from "@hardlydifficult/logger";

const tracker = createTracker();

tracker.record({
  inputTokens: 10,
  outputTokens: 5,
  prompt: "user message",
  response: "assistant response",
  durationMs: 120
});
```

## Types

### `LanguageModel`

```typescript
interface LanguageModel {
  readonly modelId: string;
  readonly provider: "anthropic" | "ollama";
  readonly supportsImages?: boolean;
  readonly supportsParallelToolCalls?: boolean;
}
```

### `AITracker`

Records usage statistics from AI interactions.

```typescript
import { AITracker } from "@hardlydifficult/ai";

const tracker: AITracker = {
  record(usage: Usage) {
    console.log(`Tokens: ${usage.inputTokens + usage.outputTokens}`);
  },
};
```

### `Usage`

Represents token usage from an AI call.

| Property | Type | Description |
|----------|------|-------------|
| inputTokens | `number` | Number of input tokens |
| outputTokens | `number` | Number of output tokens |
| inputTokenDetails | `Record<string, unknown>` | Provider-specific input token details |
| prompt? | `string` | Prompt text |
| response? | `string` | Response text |
| systemPrompt? | `string` | System prompt text |
| durationMs? | `number` | Duration in milliseconds |

### `ToolMap`

Mapping of tool names to tool definitions.

```typescript
import { ToolMap } from "@hardlydifficult/ai";

const tools: ToolMap = {
  search: {
    description: "Search the web",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => `Results for ${query}`,
  },
};
```

## Provider Differences

| Feature | Anthropic | Ollama |
|---------|-----------|--------|
| Base URL | Not used | Required (e.g., `http://localhost:11434`) |
| API Key | Required | Optional |
| Keep-alive | N/A | `keepAlive` supported (e.g., `"5m"`) |
| Timeout | Default | Customizable (default: 60s) |

### Supported Models

- **Anthropic**: Any model in the `claude-3.*` family (e.g., `claude-3-5-sonnet-20241022`)
- **Ollama**: Any local model (e.g., `llama3`, `mistral`, `gemma`)

## Types

All core interfaces are exported for integration.

| Type | Description |
|------|-------------|
| `AI` | Unified AI client interface (`chat`, `stream`, `run`) |
| `Agent` | Agent interface with `run` and `stream` methods |
| `Message` | Chat message with role + content array |
| `ContentBlock` | Text/image content blocks (Anthropic-style) |
| `Usage` | Token usage tracking `{ prompt_tokens, completion_tokens }` |
| `ToolMap` | Record of named tools with Zod schemas |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request