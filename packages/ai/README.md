# @hardlydifficult/ai

Unified AI client with chainable structured output, required usage tracking, and response parsing utilities.

## Installation

```bash
npm install @hardlydifficult/ai
```

## AI Client

### `createAI(model, tracker, options?)`

Creates an AI client. Usage tracking is **required** — every call automatically fires `tracker.record()`.

```typescript
import { createAI, claude } from "@hardlydifficult/ai";

const ai = createAI(claude("sonnet"), tracker);
```

### `chat(prompt, systemPrompt?)`

Send a prompt and get a rich response with usage info and conversation support.

```typescript
const msg = await ai.chat("Explain closures");
msg.text;  // "A closure is..."
msg.usage; // { inputTokens: 50, outputTokens: 200, durationMs: 1200 }

// With system prompt
const msg = await ai.chat("Explain closures", "You are a TypeScript tutor");
```

### `.zod(schema)` — Structured Output

Chain `.zod(schema)` to constrain the model's output format AND validate the result. The schema does triple duty: constrains output, validates response, provides TypeScript types.

```typescript
import { z } from "zod";

const TaskSchema = z.object({
  title: z.string(),
  priority: z.enum(["high", "medium", "low"]),
});

const msg = await ai.chat("Create a task for fixing the login bug").zod(TaskSchema);
msg.data; // { title: "Fix login bug", priority: "high" } — typed as z.infer<typeof TaskSchema>
```

### `.reply(prompt)` — Conversation

Continue a conversation. Message history accumulates automatically.

```typescript
const msg1 = await ai.chat("What is a monad?");
const msg2 = await msg1.reply("Give me a TypeScript example");
const msg3 = await msg2.reply("Now formalize it").zod(DefinitionSchema);
```

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

`createAI` requires an `AITracker` — no AI without tracking. The tracker fires for every call (`chat`, `reply`, `zod`).

```typescript
import type { AITracker } from "@hardlydifficult/ai";

const tracker: AITracker = {
  record({ inputTokens, outputTokens, durationMs }) {
    const cost = inputTokens * 3 / 1_000_000 + outputTokens * 15 / 1_000_000;
    console.log(`Cost: $${cost.toFixed(4)}`);
  },
};

const ai = createAI(claude("sonnet"), tracker);
```

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
