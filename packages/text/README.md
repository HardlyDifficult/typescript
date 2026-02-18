# @hardlydifficult/text

Text utilities for error formatting, template replacement, text chunking, slugification, duration formatting, YAML/JSON conversion, link generation, and file tree rendering.

## Installation

```bash
npm install @hardlydifficult/text
```

## Usage

```typescript
import * as text from "@hardlydifficult/text";

// Quick example
const output = text.replaceTemplate("Hello {{name}}!", { name: "World" });
console.log(output); // "Hello World!"
```

## Error Handling

### `getErrorMessage(err: unknown): string`

Extract a message string from an unknown error.

```typescript
import { getErrorMessage } from "@hardlydifficult/text";

try {
  throw new Error("Something went wrong");
} catch (err) {
  console.error(getErrorMessage(err)); // "Something went wrong"
}
```

### `formatError(err: unknown, context?: string): string`

Format an error with an optional context prefix.

```typescript
import { formatError } from "@hardlydifficult/text";

formatError(new Error("not found"), "User lookup"); // "User lookup: not found"
formatError(new Error("not found")); // "not found"
```

### `formatErrorForLog(err: unknown): string`

Format an error for logging. Returns `err.message` for `Error` instances, `String(err)` otherwise.

```typescript
import { formatErrorForLog } from "@hardlydifficult/text";

formatErrorForLog(new Error("Database error")); // "Database error"
```

## Template Replacement

### `replaceTemplate(template: string, values: Record<string, string>): string`

Replace `{{variable}}` placeholders with provided values.

```typescript
import { replaceTemplate } from "@hardlydifficult/text";

replaceTemplate("Hello {{name}}, welcome to {{place}}!", {
  name: "Alice",
  place: "Wonderland",
});
// "Hello Alice, welcome to Wonderland!"
```

### `extractPlaceholders(template: string): string[]`

Extract all unique placeholder names from a template string.

```typescript
import { extractPlaceholders } from "@hardlydifficult/text";

extractPlaceholders("{{name}} is in {{place}}"); // ["name", "place"]
```

## Text Processing

### `chunkText(text: string, maxLength: number): string[]`

Split text into chunks of at most `maxLength` characters, preferring line breaks and spaces.

```typescript
import { chunkText } from "@hardlydifficult/text";

const text = "Line 1\nLine 2\nThis is a very long line that needs to be chunked.";
const chunks = chunkText(text, 20);
// ["Line 1\nLine 2", "This is a very", "long line that", "needs to be", "chunked."]
```

### `slugify(input: string, maxLength?: number): string`

Convert a string to a URL/filename-safe slug.

```typescript
import { slugify } from "@hardlydifficult/text";

slugify("My Feature Name!"); // "my-feature-name"
slugify("My Feature Name!", 10); // "my-feature"
slugify("  spaces & symbols!  "); // "spaces-symbols"
```

### `formatWithLineNumbers(content: string, startLine?: number): string`

Format text content with right-aligned line numbers.

```typescript
import { formatWithLineNumbers } from "@hardlydifficult/text";

formatWithLineNumbers("foo\nbar\nbaz");
// " 1: foo\n 2: bar\n 3: baz"

formatWithLineNumbers("hello\nworld", 10);
// "10: hello\n11: world"
```

### `formatDuration(ms: number): string`

Format milliseconds as a human-readable duration string.

```typescript
import { formatDuration } from "@hardlydifficult/text";

formatDuration(125_000);   // "2m 5s"
formatDuration(3_600_000); // "1h"
formatDuration(500);       // "<1s"
formatDuration(90_000_000); // "1d 1h"
```

## Format Conversion

### `convertFormat(content: string, to: "json" | "yaml"): string`

Convert between JSON and YAML string formats with automatic input detection.

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

### `formatYaml(data: unknown): string`

Serialize data to clean YAML, using block literals for long strings containing colons.

```typescript
import { formatYaml } from "@hardlydifficult/text";

formatYaml({ message: "Hello: World" });
// "message: >\n  Hello: World"
```

### `healYaml(dirtyYaml: string): string`

Clean malformed YAML by stripping code fences and quoting problematic scalars containing colons.

```typescript
import { healYaml } from "@hardlydifficult/text";

healYaml('message: "Hello: World"'); // "message: >\n  Hello: World"
```

## Link Generation

### `createLinker(rules?: LinkRule[]): { linkText(text: string, options?: LinkOptions): string; apply: typeof linkText }`

Create a configurable linker to transform text patterns into platform-specific links.

Supports:
- Plain strings
- Idempotent re-runs
- Automatic skipping of code spans and existing links
- Deterministic conflict resolution (priority, then longest match, then rule order)

```typescript
import { createLinker } from "@hardlydifficult/text";

const linker = createLinker()
  .linear("fairmint")
  .githubPr("Fairmint/api");

linker.linkText("Fix ENG-533 and PR#42", { format: "slack" });
// "Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533> and <https://github.com/Fairmint/api/pull/42|PR#42>"

linker.linkText("Fix ENG-533 and PR#42", { format: "markdown" });
// "[ENG-533](https://linear.app/fairmint/issue/ENG-533) and [PR#42](https://github.com/Fairmint/api/pull/42)"
```

Supported formats: `slack` (`<url|text>`), `markdown`/`discord` (`[text](url)`), `plaintext` (raw URL).

| Option | Description | Default |
|--------|-------------|---------|
| `format` | Target output format | `"markdown"` |
| `platform` | Alias for `format` | `"markdown"` |
| `skipCode` | Skip linkification inside code spans | `true` |
| `skipExistingLinks` | Skip linkification inside existing links | `true` |

## File Tree Rendering

### `buildFileTree(files: string[], options?: FileTreeOptions): string`

Build and render a hierarchical file tree with depth-based truncation and directory collapsing.

```typescript
import { buildFileTree } from "@hardlydifficult/text";

const files = [
  "src/index.ts",
  "src/utils.ts",
  "src/components/Button.tsx",
];

buildFileTree(files);
// "src/\n├── index.ts\n├── utils.ts\n└── components/\n   └── Button.tsx"
```

Options include `maxDepth`, `maxDirectories`, and `collapseDirectories` for controlling tree rendering behavior.