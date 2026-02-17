# @hardlydifficult/text

Text utilities for error formatting, template replacement, chunking, and line numbering.

## Installation

```bash
npm install @hardlydifficult/text
```

## API

### `getErrorMessage(err: unknown): string`

Extract a message string from an unknown error. Returns `err.message` for `Error` instances, `String(err)` otherwise.

```typescript
import { getErrorMessage } from "@hardlydifficult/text";

try {
  await riskyOperation();
} catch (err) {
  console.error(getErrorMessage(err));
}
```

### `formatError(err: unknown, context?: string): string`

Format an error for user-facing output. Prepends an optional context prefix.

```typescript
import { formatError } from "@hardlydifficult/text";

formatError(new Error("not found"), "User lookup"); // "User lookup: not found"
formatError(new Error("not found")); // "not found"
```

### `formatErrorForLog(err: unknown): string`

Format an error for logging. Returns the message for `Error` instances, `String(err)` otherwise.

### `replaceTemplate(template: string, values: Record<string, string>): string`

Replace `{{variable}}` placeholders with provided values. Unmatched placeholders are left as-is.

```typescript
import { replaceTemplate } from "@hardlydifficult/text";

replaceTemplate("Hello {{name}}, welcome to {{place}}!", {
  name: "Alice",
  place: "Wonderland",
});
// "Hello Alice, welcome to Wonderland!"
```

### `extractPlaceholders(template: string): string[]`

Extract all unique placeholder names from a template.

```typescript
import { extractPlaceholders } from "@hardlydifficult/text";

extractPlaceholders("{{name}} is in {{place}}"); // ["name", "place"]
```

### `chunkText(text: string, maxLength: number): string[]`

Split text into chunks of at most `maxLength` characters. Prefers breaking on newlines, then spaces, and falls back to hard breaks.

```typescript
import { chunkText } from "@hardlydifficult/text";

const chunks = chunkText(longMessage, 2000);
for (const chunk of chunks) {
  await channel.send(chunk);
}
```

### `slugify(input: string, maxLength?: number): string`

Convert a string to a URL/filename-safe slug. Lowercases, replaces non-alphanumeric runs with hyphens, truncates at word boundaries.

```typescript
import { slugify } from "@hardlydifficult/text";

slugify("My Feature Name!"); // "my-feature-name"
slugify("My Feature Name!", 10); // "my-feature"
```

### `formatDuration(ms: number): string`

Format milliseconds as a short human-readable duration. Shows at most two units, skipping trailing zeros.

```typescript
import { formatDuration } from "@hardlydifficult/text";

formatDuration(125_000);   // "2m 5s"
formatDuration(3_600_000); // "1h"
formatDuration(500);       // "<1s"
formatDuration(90_000_000); // "1d 1h"
```

### `convertFormat(content: string, to: TextFormat): string`

Convert between JSON and YAML string formats. Auto-detects the input format and serializes to the requested output format.

```typescript
import { convertFormat } from "@hardlydifficult/text";

// JSON to YAML
convertFormat('{"name": "Alice", "age": 30}', "yaml");
// name: Alice
// age: 30

// YAML to JSON
convertFormat("name: Alice\nage: 30", "json");
// {
//   "name": "Alice",
//   "age": 30
// }
```

The function tries to parse as JSON first, then falls back to YAML. Returns pretty-printed JSON with 2-space indent or clean YAML. Throws a descriptive error if the input is neither valid JSON nor YAML.

### `formatWithLineNumbers(content: string, startLine?: number): string`

Format text content with right-aligned line numbers. Each line is prefixed with its line number, padded to align properly based on the maximum line number.

```typescript
import { formatWithLineNumbers } from "@hardlydifficult/text";

// Default: starts at line 1
formatWithLineNumbers("foo\nbar\nbaz");
// 1: foo
// 2: bar
// 3: baz

// Custom starting line for displaying file ranges
formatWithLineNumbers("hello\nworld", 10);
// 10: hello
// 11: world

// Proper alignment for larger line numbers
formatWithLineNumbers("line 1\nline 2\n...\nline 100", 98);
//  98: line 1
//  99: line 2
// 100: ...
// 101: line 100
```

This is useful for displaying code snippets, file contents, or log output with line numbers for reference.

### `createLinker(rules?)`

Create a reusable linker that turns matched text patterns into platform-specific links.

Supports:

- plain strings
- idempotent re-runs (won't double-link existing linked text)
- skipping code spans/backticks and existing links by default
- deterministic conflict handling (priority, then longest match, then rule order)

```typescript
import { createLinker } from "@hardlydifficult/text";

const linker = createLinker()
  .linear("fairmint")
  .githubPr("Fairmint/api")
  .custom(/\bINC-\d+\b/g, ({ match }) => `https://incident.io/${match}`);

const slack = linker.linkText("Fix ENG-533 and PR#42", { format: "slack" });
// "Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533> and <https://github.com/Fairmint/api/pull/42|PR#42>"
```

You can also pass rules up front:

```typescript
const linker = createLinker([
  {
    pattern: /\b([A-Z]{2,6}-\d+)\b/g,
    href: "https://linear.app/fairmint/issue/$1",
  },
]);
```

Formats:

- `slack` → `<url|text>`
- `markdown` / `discord` → `[text](url)`
- `plaintext` → raw `url`

`linker.apply(text, options)` is an alias of `linker.linkText(text, options)`.
