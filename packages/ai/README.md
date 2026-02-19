# @hardlydifficult/ai

Unified AI client with chainable structured output, streaming, tool-calling agents, and response utilities.

## Installation

```bash
npm install @hardlydifficult/ai
```

## Quick Start

```typescript
import { createAI, claude, createPromptLoader } from "@hardlydifficult/ai";
import type { AITracker } from "@hardlydifficult/ai";

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

### createAI(model, tracker, logger, options?)

Creates an AI client bound to a specific language model.

| Parameter | Type | Description |
|----------|------|-------------|
| model | `LanguageModel` | AI SDK language model instance |
| tracker | `AITracker` | Usage tracking implementation |
| logger | `Logger` | Logging implementation |
| options?.maxTokens | `number` | Maximum output tokens (default: 4096) |
| options?.temperature | `number` | Temperature for generation (default: undefined) |

```typescript
import { createAI, claude } from "@hardlydifficult/ai";
import type { AITracker } from "@hardlydifficult/ai";

const model = claude("sonnet");

const tracker: AITracker = {
  record(usage) {
    console.log(`Input: ${usage.inputTokens}, Output: ${usage.outputTokens}`);
  },
};

const ai = createAI(model, tracker, console, { maxTokens: 8192 });
```

### AI.chat(prompt, systemPrompt?)

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

### AI.stream(messages, onText)

Streams a response token-by-token.

| Parameter | Type | Description |
|----------|------|-------------|
| messages | `Message[]` | Message history |
| onText | `(text: string) => void` | Callback for each text chunk |

```typescript
await ai.stream(
  [{ role: "user", content: "Write a haiku" }],
  (chunk) => process.stdout.write(chunk)
);
```

### AI.agent(tools, options?)

Creates a tool-calling agent.

```typescript
const agent = ai.agent(
  {
    search: {
      description: "Search the web",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => `Results for ${query}`,
    },
  },
  { maxSteps: 5 }
);

const result = await agent.run([{ role: "user", content: "Search for AI news" }]);
```

## LLM Providers

### claude(variant)

Creates an Anthropic language model from a short variant name.

```typescript
import { claude } from "@hardlydifficult/ai";

const sonnet = claude("sonnet"); // claude-sonnet-4-5
const haiku = claude("haiku");   // claude-haiku-4-5
const opus = claude("opus");     // claude-opus-4-6
```

### ollama(model)

Creates an Ollama language model with extended HTTP timeouts and `keep_alive: -1` support.

```typescript
import { ollama } from "@hardlydifficult/ai";

const model = ollama("llama3"); // Uses installed local model
```

## Agents

### AgentConversation

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

### createAgent(model, tools, tracker, logger, options?)

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

### runStream(model, tracker, logger, messages, onText, maxTokens, temperature?)

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

### extractJson(text, sentinel?)

Extracts JSON values from text using progressive strategies: direct parse, code blocks, then balanced-brace scanning.

```typescript
import { extractJson } from "@hardlydifficult/ai";

const text = 'Result: {"name":"Alice"} in prose';
const results = extractJson(text); // [{ name: "Alice" }]

// Extract from code blocks
const codeResult = extractJson("```json\n{\"a\":1}\n```"); // [{ a: 1 }]
```

### extractTyped(text, schema, sentinel?)

Extracts and validates typed JSON objects from text using a schema-like interface.

```typescript
import { extractTyped } from "@hardlydifficult/ai";
import { z } from "zod";

const text = '{"name":"Alice","age":30}';
const results = extractTyped(text, z.object({ name: z.string(), age: z.number() }));
// [{ name: "Alice", age: 30 }]
```

### extractCodeBlock(text, lang?)

Extracts fenced code blocks from text, optionally filtered by language tag.

```typescript
import { extractCodeBlock } from "@hardlydifficult/ai";

const text = "```ts\nconst x = 1;\n```\n```json\n{\"a\":1}\n```";
const tsCode = extractCodeBlock(text, "ts"); // ["const x = 1;"]
const jsonCode = extractCodeBlock(text, "json"); // ['{"a":1}']
```

### extractStructured(text, schema, sentinel?)

Extracts and validates structured data using a schema-like interface.

```typescript
import { extractStructured } from "@hardlydifficult/ai";
import { z } from "zod";

const text = '{"name":"Alice","age":30}';
const results = extractStructured(text, z.object({ name: z.string(), age: z.number() }));
// [{ name: "Alice", age: 30 }]
```

## Response Utilities

### Message

Represents a chat message with methods for extracting structured data.

```typescript
import { Message } from "@hardlydifficult/ai";

const msg = new Message("Hello", 10, 5);

const text = msg.text(); // "Hello"
const json = msg.json(); // Attempts to parse as JSON
const zodData = msg.zod(z.object({ foo: z.string() })); // Validates with Zod
```

### Message.reply(prompt)

Appends a follow-up message to the conversation history.

```typescript
const msg = await ai.chat("What is TypeScript?");
const reply = await msg.reply("Explain the benefits");
```

## Utility Functions

### createPromptLoader(directory, filename)

Loads prompt files from disk with caching.

```typescript
import { createPromptLoader } from "@hardlydifficult/ai";

const load = createPromptLoader("prompts", "system.md");

const systemPrompt = load(); // Returns file contents
```

## Types

### AITracker

Records usage statistics from AI interactions.

```typescript
import { AITracker } from "@hardlydifficult/ai";

const tracker: AITracker = {
  record(usage: Usage) {
    console.log(`Tokens: ${usage.inputTokens + usage.outputTokens}`);
  },
};
```

### Usage

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

### ToolMap

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request