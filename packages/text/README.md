# @hardlydifficult/text

Text utilities for error formatting, template replacement, text chunking, slugification, duration formatting, YAML/JSON conversion, link generation, and file tree rendering.

## Installation

```bash
npm install @hardlydifficult/text
```

## Quick Start

```typescript
import {
  replaceTemplate,
  chunkText,
  slugify,
  formatDuration,
  buildFileTree,
  convertFormat,
  createLinker,
  healYaml,
  escapeFence,
} from "@hardlydifficult/text";

// Replace template placeholders
replaceTemplate("Hello {{name}}!", { name: "World" });
// "Hello World!"

// Split long text into chunks
chunkText("This is a long text", 10);
// ["This is a", "long text"]

// Convert to URL-safe slugs
slugify("My Feature Name!");
// "my-feature-name"

// Format durations
formatDuration(125_000);
// "2m 5s"

// Build file trees
buildFileTree(["src/index.ts", "README.md"]);
// "```\nsrc/\n  index.ts\n\nREADME.md\n```"

// Convert between JSON and YAML
convertFormat('{"name":"Alice"}', "yaml");
// "name: Alice\n"
convertFormat("name: Alice", "json");
// "{\n  \"name\": \"Alice\"\n}"

// Apply link rules to text
const linker = createLinker().linear("my-org");
linker.apply("Fix ENG-533", { platform: "markdown" });
// "Fix [ENG-533](https://linear.app/my-org/issue/ENG-533)"

// Heal malformed YAML
healYaml("```yaml\nkey: value\n```");
// "key: value"
```

## Error Formatting

Consistent error handling utilities for message extraction and formatting.

### `getErrorMessage`

Extract a message string from an unknown error.

```typescript
import { getErrorMessage } from "@hardlydifficult/text";

getErrorMessage(new Error("something went wrong"));
// "something went wrong"

getErrorMessage("plain string error");
// "plain string error"

getErrorMessage(42);
// "42"
```

### `formatError`

Format an error for user-facing output with optional context.

```typescript
import { formatError } from "@hardlydifficult/text";

formatError(new Error("disk full"));
// "disk full"

formatError(new Error("disk full"), "Failed to save");
// "Failed to save: disk full"
```

### `formatErrorForLog`

Format an error for logging (includes more detail for non-Error types).

```typescript
import { formatErrorForLog } from "@hardlydifficult/text";

formatErrorForLog(new Error("timeout"));
// "timeout"

formatErrorForLog({ code: 500 });
// "[object Object]"
```

## Template Replacement

Simple string interpolation using `{{variable}}` syntax.

### `replaceTemplate`

Replace template placeholders with values.

```typescript
import { replaceTemplate } from "@hardlydifficult/text";

replaceTemplate("Hello {{name}}!", { name: "World" });
// "Hello World!"

replaceTemplate("{{greeting}}, {{name}}!", {
  greeting: "Hi",
  name: "Alice",
});
// "Hi, Alice!"

replaceTemplate("Hello {{name}}!", {});
// "Hello {{name}}!"
```

### `extractPlaceholders`

Extract all placeholder names from a template.

```typescript
import { extractPlaceholders } from "@hardlydifficult/text";

extractPlaceholders("{{a}} and {{b}} and {{a}} again");
// ["a", "b"]

extractPlaceholders("no placeholders here");
// []
```

## Text Chunking

Split long text into manageable chunks, preferring natural break points.

```typescript
import { chunkText } from "@hardlydifficult/text";

chunkText("line one\nline two\nline three", 18);
// ["line one\nline two", "line three"]

chunkText("word1 word2 word3 word4 word5", 17);
// ["word1 word2 word3", "word4 word5"]

chunkText("abcdefghijklmnopqrstuvwxyz", 10);
// ["abcdefghij", "klmnopqrst", "uvwxyz"]
```

## Slugification

Convert strings into URL/filename-safe slugs.

```typescript
import { slugify } from "@hardlydifficult/text";

slugify("My Feature Name!");
// "my-feature-name"

slugify("My Feature Name!", 10);
// "my-feature"

slugify("  Hello World  ");
// "hello-world"
```

## Duration Formatting

Format duration in milliseconds as a human-readable string.

```typescript
import { formatDuration } from "@hardlydifficult/text";

formatDuration(125_000);
// "2m 5s"

formatDuration(3_600_000);
// "1h"

formatDuration(500);
// "<1s"
```

## File Tree Rendering

Build and render hierarchical file trees with depth-based truncation, annotations, and collapsed directory summaries.

```typescript
import { buildFileTree, FILE_TREE_DEFAULTS } from "@hardlydifficult/text";

buildFileTree(["src/index.ts", "src/utils.ts", "README.md"]);
// "src/\n  index.ts\n  utils.ts\n\nREADME.md"
```

### Options

| Parameter      | Type                                      | Description                                                                 |
|----------------|-------------------------------------------|-----------------------------------------------------------------------------|
| `maxLevel2`    | `number`                                  | Maximum number of entries to show at level 2 (files in a directory)        |
| `maxLevel3`    | `number`                                  | Maximum number of entries to show at level 3 (files in subdirectories)     |
| `annotations`  | `ReadonlyMap<string, string>`             | Map of file/directory paths to annotation strings                           |
| `details`      | `ReadonlyMap<string, readonly string[]>` | Map of file paths to extra detail lines to show under entries              |
| `collapseDirs` | `readonly string[]`                       | Directory names to collapse with summary count                             |
| `format`       | `'plain' \| 'markdown'`                  | Output format. Defaults to `'markdown'`, which wraps the tree in a code fence for correct markdown rendering. Use `'plain'` when the caller already provides a fence (e.g. AI prompt templates). |

### Examples

**Annotations**

```typescript
const annotations = new Map([
  ["src/index.ts", "Main entry point"],
  ["src", "Source code directory"],
]);

buildFileTree(["src/index.ts"], { annotations });
// "```\nsrc/ — Source code directory\n  index.ts — Main entry point\n```"
```

**Details**

```typescript
const details = new Map([
  ["src/index.ts", ["> main (5-20): App entry point."]],
]);

buildFileTree(["src/index.ts"], { details });
// "```\nsrc/\n  index.ts\n    > main (5-20): App entry point.\n```"
```

**Collapsed directories**

```typescript
buildFileTree(
  ["src/index.ts", "test/unit/a.test.ts", "test/unit/b.test.ts"],
  { collapseDirs: ["test"] }
);
// "```\nsrc/\n  index.ts\n\ntest/\n  (2 files)\n```"
```

## JSON/YAML Format Conversion

Convert between JSON and YAML with automatic input detection and clean output formatting.

```typescript
import { convertFormat } from "@hardlydifficult/text";

convertFormat('{"name":"Alice","age":30}', "yaml");
// "name: Alice\nage: 30\n"

convertFormat("name: Alice\nage: 30", "json");
// "{\n  \"name\": \"Alice\",\n  \"age\": 30\n}"
```

### `TextFormat`

Type alias for output format: `"json"` or `"yaml"`.

## YAML Formatting

Serialize data to clean YAML with intelligent block literal selection for long strings.

```typescript
import { formatYaml } from "@hardlydifficult/text";

formatYaml({
  purpose:
    "Core AI SDK implementation: LLM integrations (Anthropic Claude, Ollama), agent orchestration with streaming.",
});

// Uses block literal (|) for long strings containing ": "
// purpose: |
//   Core AI SDK implementation: LLM integrations (Anthropic Claude, Ollama), agent orchestration with streaming.
```

## YAML Healing

Clean and repair YAML output from LLMs by stripping code fences and quoting problematic scalar values.

```typescript
import { healYaml } from "@hardlydifficult/text";

healYaml("```yaml\nkey: value\n```");
// "key: value"

healYaml('description: Development dependencies: Node types.');
// 'description: "Development dependencies: Node types."'
```

## Link Generation

Transform text with issue/PR references into formatted links across platforms like Slack, Discord, and Markdown.

### `createLinker`

Create a linker instance with optional initial rules.

```typescript
import { createLinker } from "@hardlydifficult/text";

const linker = createLinker()
  .linear("my-org")
  .githubPr("my-org/my-repo");

linker.apply("Fix ENG-533 and PR#42", { platform: "slack" });
// "Fix <https://linear.app/my-org/issue/ENG-533|ENG-533> <https://github.com/my-org/my-repo/pull/42|PR#42>"
```

### `Linker` Class

Stateful linker that applies configured rules to text.

**Methods:**

| Method         | Description                                                            |
|----------------|------------------------------------------------------------------------|
| `addRule(rule)`| Add a custom link rule                                                 |
| `rule(...)`    | Add a rule (supports fluent and named forms)                           |
| `custom(...)`  | Add a custom rule with regex pattern and href builder                  |
| `linear(...)`  | Add Linear issue reference rule (e.g., `ENG-533`)                      |
| `githubPr(...)`| Add GitHub PR reference rule (e.g., `PR#42`)                           |
| `apply(...)`   | Apply linkification to text with options                               |
| `linkText(...)`| Alias for `apply` (same behavior)                                      |

### Rules

| Parameter | Type                      | Description                                                                 |
|-----------|---------------------------|-----------------------------------------------------------------------------|
| `pattern` | `RegExp`                  | Match pattern (global flag is enforced automatically)                       |
| `href`    | `string`                  | URL template (supports `$0`/`$&`, `$1..$N`)                                |
| `toHref`  | `string \| LinkHrefBuilder`| Either href template or callback; takes precedence over `href`            |
| `priority`| `number`                  | Higher priority wins for overlapping matches (default: `0`)               |

### Options

| Parameter             | Type                        | Description                                                             |
|-----------------------|-----------------------------|-------------------------------------------------------------------------|
| `format` / `platform` | `LinkerPlatform`            | Output format: `"slack"`, `"discord"`, `"markdown"`, `"plaintext"`     |
| `skipCode`            | `boolean`                   | Skip linkification inside code spans (default: `true`)                 |
| `skipExistingLinks`   | `boolean`                   | Skip linkification inside existing links (default: `true`)             |

### Platforms

| Platform     | Format                          |
|--------------|---------------------------------|
| `slack`      | `<href|text>`                   |
| `discord`    | `[text](href)`                  |
| `markdown`   | `[text](href)`                  |
| `plaintext`  | `href` (raw URL)                |

### Examples

**Custom rules**

```typescript
const linker = createLinker().custom(
  /\bINC-\d+\b/g,
  ({ match }) => `https://incident.io/${match}`
);
linker.apply("Handle INC-99", { format: "slack" });
// "Handle <https://incident.io/INC-99|INC-99>"
```

**Priority-based resolution**

```typescript
const linker = createLinker()
  .custom(/\bENG-\d+\b/g, "https://low.example/$0", { priority: 0 })
  .custom(/\bENG-533\b/g, "https://high.example/$0", { priority: 10 });

linker.apply("ENG-533 and ENG-534", { format: "markdown" });
// "[ENG-533](https://high.example/ENG-533) and [ENG-534](https://low.example/ENG-534)"
```

**Idempotent linkification**

```typescript
const linker = createLinker().linear("my-org");
const first = linker.apply("Ship ENG-533", { format: "slack" });
const second = linker.apply(first, { format: "slack" });
// first === second (no double-linkification)
```

## Text with Line Numbers

Format text content with right-aligned line numbers.

```typescript
import { formatWithLineNumbers } from "@hardlydifficult/text";

formatWithLineNumbers("foo\nbar\nbaz");
// 1: foo
// 2: bar
// 3: baz

formatWithLineNumbers("hello\nworld", 10);
// 10: hello
// 11: world
```

## Escaping Markdown Fences

Escape markdown code fences by dynamically selecting a fence delimiter longer than any backtick sequence in the content.

```typescript
import { escapeFence } from "@hardlydifficult/text";

escapeFence("Content with `` backticks");
// { fence: "````", content: "Content with `` backticks" }
```