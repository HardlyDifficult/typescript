# @hardlydifficult/ai-msg

Opinionated utilities for extracting structured output from AI text responses.

LLM responses often wrap structured data in markdown code blocks, preamble text, or trailing commentary. This package reliably extracts JSON and code blocks from messy AI output.

## Installation

```bash
npm install @hardlydifficult/ai-msg
```

For typed extraction with Zod validation:

```bash
npm install @hardlydifficult/ai-msg zod
```

## Usage

### `extractJson(text): unknown | null`

Extracts the first valid JSON value from text using a three-pass strategy:

1. Direct `JSON.parse` of the trimmed text
2. Search markdown code blocks (json-tagged first, then any)
3. Find balanced `{}` or `[]` substrings in prose

```typescript
import { extractJson } from "@hardlydifficult/ai-msg";

extractJson('{"key": "value"}');
// { key: "value" }

extractJson('Here is the result:\n```json\n{"key": "value"}\n```\nDone.');
// { key: "value" }

extractJson('The answer is {"key": "value"} as shown.');
// { key: "value" }

extractJson("no json here");
// null
```

### `extractCodeBlock(text, lang?): string[]`

Extracts all markdown code blocks from text. Optionally filters by language tag.

```typescript
import { extractCodeBlock } from "@hardlydifficult/ai-msg";

extractCodeBlock("```ts\nconst x = 1;\n```");
// ["const x = 1;"]

extractCodeBlock("```json\n{}\n```\n```ts\nconst x = 1;\n```", "json");
// ["{}"]

extractCodeBlock("no code blocks");
// []
```

### `extractTyped<T>(text, schema): T | null`

Extracts JSON from text and validates it against a Zod schema. Requires `zod` as a peer dependency.

```typescript
import { extractTyped } from "@hardlydifficult/ai-msg";
import { z } from "zod";

const Person = z.object({ name: z.string(), age: z.number() });

extractTyped('{"name": "Alice", "age": 30}', Person);
// { name: "Alice", age: 30 }

extractTyped('{"name": "Alice", "age": "thirty"}', Person);
// null
```
