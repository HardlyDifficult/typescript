# @hardlydifficult/text

Text utilities for error formatting, template replacement, text chunking, slugification, duration formatting, YAML/JSON conversion, link generation, and file tree rendering.

## Installation

```bash
npm install @hardlydifficult/text
```

## Quick Start

```typescript
import * as text from "@hardlydifficult/text";

// Template replacement
const greeting = text.replaceTemplate("Hello {{name}}!", { name: "World" });
console.log(greeting); // "Hello World!"

// Text chunking
const chunks = text.chunkText("Line 1\nLine 2\nLong line", 15);
console.log(chunks); // ["Line 1\nLine 2", "Long line"]

// Slugification
console.log(text.slugify("My Feature Name!")); // "my-feature-name"

// Duration formatting
console.log(text.formatDuration(125_000)); // "2m 5s"
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

Split text into chunks of at most `maxLength` characters, preferring line breaks and spaces for natural breaks.

```typescript
import { chunkText } from "@hardlydifficult/text";

const text = "Line 1\nLine 2\nThis is a very long line that needs to be chunked.";
const chunks = chunkText(text, 20);
// ["Line 1\nLine 2", "This is a very", "long line that", "needs to be", "chunked."]
```

### `slugify(input: string, maxLength?: number): string`

Convert a string to a URL/filename-safe slug by lowercasing, replacing non-alphanumeric characters with hyphens, and optionally truncating at hyphen boundaries.

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

Format milliseconds as a human-readable duration string, showing up to two units and using "<1s" for sub-second values.

```typescript
import { formatDuration } from "@hardlydifficult/text";

formatDuration(125_000);   // "2m 5s"
formatDuration(3_600_000); // "1h"
formatDuration(500);       // "<1s"
formatDuration(90_000_000); // "1d 1h"
```

## Format Conversion

### `convertFormat(content: string, to: "json" | "yaml"): string`

Convert between JSON and YAML string formats with automatic input format detection.

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

Clean malformed YAML by stripping markdown code fences and quoting problematic scalar values containing colons.

```typescript
import { healYaml } from "@hardlydifficult/text";

healYaml('```yaml\nmessage: Hello: World\n```');
// "message: >\n  Hello: World"
```

## Link Generation

### `createLinker(initialRules?: LinkRule[]): Linker`

Create a configurable linker to transform text patterns into platform-specific links. The linker is idempotent by default, skips code spans and existing links, and resolves overlapping matches deterministically.

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

#### Linker Methods

**`.linear(workspace: string, options?: { name?: string; priority?: number }): Linker`**

Add a rule for Linear issue references (e.g., `ENG-533`).

```typescript
const linker = createLinker().linear("fairmint");
linker.linkText("Fix ENG-533", { format: "markdown" });
// "[ENG-533](https://linear.app/fairmint/issue/ENG-533)"
```

**`.githubPr(repository: string, options?: { name?: string; priority?: number }): Linker`**

Add a rule for GitHub pull request references (e.g., `PR#42`).

```typescript
const linker = createLinker().githubPr("Fairmint/api");
linker.linkText("Merge PR#42", { format: "markdown" });
// "[PR#42](https://github.com/Fairmint/api/pull/42)"
```

**`.custom(pattern: RegExp, toHref: string | LinkHrefBuilder, options?: { name?: string; priority?: number }): Linker`**

Add a custom rule with a regex pattern and URL template or callback.

```typescript
const linker = createLinker().custom(
  /\bINC-\d+\b/g,
  ({ match }) => `https://incident.io/${match}`
);
linker.linkText("Resolve INC-99", { format: "markdown" });
// "[INC-99](https://incident.io/INC-99)"
```

**`.linkText(input: string, options?: LinkerApplyOptions): string`**

Apply all configured rules to the input text and return formatted links.

**`.apply(input: string, options?: LinkerApplyOptions): string`**

Alias for `linkText()`.

#### Link Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `"slack" \| "discord" \| "markdown" \| "plaintext"` | `"markdown"` | Target output format |
| `platform` | `"slack" \| "discord" \| "markdown" \| "plaintext"` | `"markdown"` | Alias for `format` |
| `skipCode` | `boolean` | `true` | Skip linkification inside code spans (backticks and fenced blocks) |
| `skipExistingLinks` | `boolean` | `true` | Skip linkification inside existing links (Slack, Markdown, and plain URLs) |

#### URL Template Syntax

When using a string template for `href` or `toHref`, the following substitutions are available:

- `$0` or `$&` — Full regex match
- `$1`, `$2`, etc. — Capture groups
- `$$` — Literal `$`

```typescript
const linker = createLinker().custom(
  /\b([A-Z]{2,6})-(\d+)\b/g,
  "https://example.com/issues/$1/$2"
);
linker.linkText("ENG-533", { format: "markdown" });
// "[ENG-533](https://example.com/issues/ENG/533)"
```

## File Tree Rendering

### `buildFileTree(files: string[], options?: BuildTreeOptions): string`

Build and render a hierarchical file tree with depth-based truncation and optional annotations.

```typescript
import { buildFileTree } from "@hardlydifficult/text";

const files = [
  "src/index.ts",
  "src/utils.ts",
  "src/components/Button.tsx",
  "README.md",
];

buildFileTree(files);
// src/
//   index.ts
//   utils.ts
//   components/
//     Button.tsx
//
// README.md
```

#### Tree Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxLevel2` | `number` | `10` | Maximum children to show at depth 2 |
| `maxLevel3` | `number` | `3` | Maximum children to show at depth 3+ |
| `annotations` | `Map<string, string>` | — | Descriptions to append to entries (e.g., `"src/index.ts" → "Main entry point"`) |
| `details` | `Map<string, string[]>` | — | Extra indented lines to show under file entries (e.g., key sections) |
| `collapseDirs` | `string[]` | — | Directory names to collapse with a summary instead of expanding |

#### Annotations Example

```typescript
const annotations = new Map([
  ["src", "Source code"],
  ["src/index.ts", "Main entry point"],
]);

buildFileTree(["src/index.ts", "src/utils.ts"], { annotations });
// src/ — Source code
//   index.ts — Main entry point
//   utils.ts
```

#### Details Example

```typescript
const details = new Map([
  [
    "src/index.ts",
    [
      "> main (5-20): App entry point.",
      "> shutdown (22-35): Cleanup handler.",
    ],
  ],
]);

buildFileTree(["src/index.ts"], { details });
// src/
//   index.ts
//     > main (5-20): App entry point.
//     > shutdown (22-35): Cleanup handler.
```

#### Collapsed Directories Example

```typescript
buildFileTree(
  [
    "node_modules/package-a/index.js",
    "node_modules/package-b/index.js",
    "src/index.ts",
  ],
  { collapseDirs: ["node_modules"] }
);
// node_modules/
//   (2 files across 2 dirs)
//
// src/
//   index.ts
```

### `FILE_TREE_DEFAULTS`

Default truncation limits for file tree rendering.

```typescript
import { FILE_TREE_DEFAULTS } from "@hardlydifficult/text";

console.log(FILE_TREE_DEFAULTS.maxLevel2); // 10
console.log(FILE_TREE_DEFAULTS.maxLevel3); // 3
```