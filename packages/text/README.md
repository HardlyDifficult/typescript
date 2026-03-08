# @hardlydifficult/text

Collection of text utility functions for error formatting, template replacement, chunking, slugification, duration formatting, YAML/JSON conversion, link generation, and file tree rendering.

## Installation

```bash
npm install @hardlydifficult/text
```

## Quick Start

```typescript
import {
  formatError,
  replaceTemplate,
  chunkText,
  slugify,
  formatDuration,
  formatWithLineNumbers,
  buildFileTree,
  convertFormat,
  healYaml,
  linkText,
  codeBlock,
  stripAnsi
} from "@hardlydifficult/text";

// Format an error with context
formatError(new Error("File not found"), "Failed to load");
// "Failed to load: File not found"

// Replace template placeholders
replaceTemplate("Hello {{name}}!", { name: "World" });
// "Hello World!"

// Split text into chunks
chunkText("line1\nline2\nline3", 10);
// ["line1\nline2", "line3"]

// Create URL-safe slugs
slugify("My Feature Name!", 10);
// "my-feature"

// Format duration as human-readable string
formatDuration(125_000);
// "2m 5s"

// Add line numbers to text
formatWithLineNumbers("foo\nbar", 10);
// "10: foo\n11: bar"

// Build a file tree from paths
buildFileTree(["src/index.ts", "src/utils.ts"], { format: "plain" });
// "src/\n  index.ts\n  utils.ts"

// Convert between JSON and YAML
convertFormat('{"key": "value"}', "yaml");
// "key: value\n"

// Heal malformed YAML
healYaml('description: "Text with: colon"');
// 'description: "Text with: colon"'

// Linkify issue references
linkText("Fix ENG-533", { linear: "fairmint", for: "slack" });
// "Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533>"

// Build a safe markdown code block
codeBlock("code with ``` backticks", "ts");
// "````ts\ncode with ``` backticks\n````"

// Strip ANSI codes
stripAnsi("\x1b[31mRed text\x1b[0m");
// "Red text"
```

## Error Handling

Consistent error message extraction and formatting utilities for user-facing and logging contexts.

### getErrorMessage

Extracts a string message from any error-like value.

```typescript
import { getErrorMessage } from "@hardlydifficult/text";

getErrorMessage(new Error("Oops")); // "Oops"
getErrorMessage("plain string");    // "plain string"
getErrorMessage(42);                // "42"
```

### formatError

Formats an error with optional context prefix.

```typescript
import { formatError } from "@hardlydifficult/text";

formatError(new Error("disk full"));
// "disk full"

formatError(new Error("disk full"), "Failed to save");
// "Failed to save: disk full"
```

### formatErrorForLog

Formats an error for logging (returns message for Error instances, stringifies others).

```typescript
import { formatErrorForLog } from "@hardlydifficult/text";

formatErrorForLog(new Error("timeout")); // "timeout"
formatErrorForLog({ code: 500 });         // "[object Object]"
```

## Template Replacement

Simple template utility for placeholder replacement using `{{variable}}` syntax.

### replaceTemplate

Replaces `{{variable}}` placeholders with provided values.

```typescript
import { replaceTemplate } from "@hardlydifficult/text";

replaceTemplate("Hello {{name}}!", { name: "World" });
// "Hello World!"

replaceTemplate("{{greeting}}, {{name}}!", { greeting: "Hi" });
// "Hi, {{name}}!" // missing key leaves placeholder unchanged
```

### extractPlaceholders

Extracts unique placeholder names from a template.

```typescript
import { extractPlaceholders } from "@hardlydifficult/text";

extractPlaceholders("{{a}} and {{b}} and {{a}} again");
// ["a", "b"]
```

## Text Chunking

Splits long text into manageable chunks, preferring natural breaks.

### chunkText

Splits text at line breaks or spaces, falling back to hard breaks when necessary.

```typescript
import { chunkText } from "@hardlydifficult/text";

chunkText("word1 word2 word3", 12);
// ["word1 word2", "word3"]

chunkText("line1\nline2\nline3", 10);
// ["line1\nline2", "line3"]
```

## Slugification

Converts strings into URL/filename-safe slugs.

### slugify

Lowercases, replaces non-alphanumeric characters with hyphens, and optionally truncates at hyphen boundaries.

```typescript
import { slugify } from "@hardlydifficult/text";

slugify("My Feature Name!"); // "my-feature-name"
slugify("My Feature Name!", 10); // "my-feature"
slugify("  Hello World  "); // "hello-world"
```

## Duration Formatting

Formats milliseconds as human-readable strings.

### formatDuration

Renders durations with up to two units, skipping trailing zeros.

```typescript
import { formatDuration } from "@hardlydifficult/text";

formatDuration(500);       // "<1s"
formatDuration(125_000);   // "2m 5s"
formatDuration(3_600_000); // "1h"
formatDuration(86_400_000); // "1d"
```

## Line Number Formatting

Adds right-aligned line numbers to text.

### formatWithLineNumbers

Adds line numbers with configurable starting value.

```typescript
import { formatWithLineNumbers } from "@hardlydifficult/text";

formatWithLineNumbers("foo\nbar\nbaz");
// "1: foo\n2: bar\n3: baz"

formatWithLineNumbers("hello\nworld", 10);
// "10: hello\n11: world"
```

## File Tree Building

Builds a hierarchical file tree from flat paths with depth-based truncation.

### buildFileTree

Renders markdown-formatted (default) or plain file trees with annotations, details, and collapsed directory summaries.

```typescript
import { buildFileTree, FILE_TREE_DEFAULTS } from "@hardlydifficult/text";
import type { BuildTreeOptions } from "@hardlydifficult/text";

// Basic usage
buildFileTree(["src/index.ts", "README.md"]);
// "```\nsrc/\n  index.ts\n\nREADME.md\n```"

// Options interface
interface BuildTreeOptions {
  maxLevel2?: number;       // Max children at depth 2 (default: 10)
  maxLevel3?: number;       // Max children at depth 3+ (default: 3)
  annotations?: Map<string, string>;
  details?: Map<string, readonly string[]>;
  collapseDirs?: readonly string[];
  lineCounts?: Map<string, number>;
  format?: "plain" | "markdown"; // default: "markdown"
}

const paths = ["src/index.ts", "src/utils.ts"];
buildFileTree(paths, { format: "plain" });
// "src/\n  index.ts\n  utils.ts"

// With annotations
const annotations = new Map([["src/index.ts", "Main entry point"]]);
buildFileTree(paths, { annotations, format: "plain" });
// "src/\n  index.ts — Main entry point\n  utils.ts"
```

### FILE_TREE_DEFAULTS

Default truncation limits for file tree rendering.

```typescript
import { FILE_TREE_DEFAULTS } from "@hardlydifficult/text";

FILE_TREE_DEFAULTS; // { maxLevel2: 10, maxLevel3: 3 }
```

## Format Conversion

Bidirectional conversion between JSON and YAML.

### convertFormat

Auto-detects input format and converts to the requested format.

```typescript
import { convertFormat, type TextFormat } from "@hardlydifficult/text";

convertFormat('{"name": "Alice"}', "yaml");
// "name: Alice\n"

convertFormat("name: Alice\nage: 30", "json");
// "{\n  \"name\": \"Alice\",\n  \"age\": 30\n}"
```

## YAML Utilities

Serialization and repair utilities for YAML.

### formatYaml

Serializes data to clean YAML with block literals for long strings containing `": "`.

```typescript
import { formatYaml } from "@hardlydifficult/text";

formatYaml({ purpose: "Core AI SDK: LLM integrations." });
// "purpose: |\n  Core AI SDK: LLM integrations.\n"
```

### healYaml

Strips markdown fences and quotes scalar values containing colons.

```typescript
import { healYaml } from "@hardlydifficult/text";

healYaml("```yaml\nkey: value\n```");
// "key: value"

healYaml("description: Text: with colons");
// 'description: "Text: with colons"'
```

## Linkifying References

Turns issue and PR references into links without builder ceremony.

### linkText

Best for one-off calls. Built-in presets cover the formats used in this repo.

```typescript
import { linkText } from "@hardlydifficult/text";

linkText("Fix ENG-533 PR#42", {
  linear: "fairmint",
  githubPrs: "Fairmint/api",
  for: "slack",
});
// "Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533> <https://github.com/Fairmint/api/pull/42|PR#42>"
```

```typescript
interface LinkTextOptions {
  linear?: string;
  githubPrs?: string;
  rules?: LinkRule[];
  for?: LinkStyle; // "slack" | "discord" | "markdown" | "plain"
  ignoreCode?: boolean; // default: true
  ignoreExistingLinks?: boolean; // default: true
}
```

### createLinker

Use this when the same link rules are applied repeatedly.

```typescript
import { createLinker } from "@hardlydifficult/text";

const linker = createLinker({
  linear: "fairmint",
  githubPrs: "Fairmint/api",
  rules: [
    {
      name: "incident",
      match: /\bINC-\d+\b/g,
      to: ({ text }) => `https://incident.io/${text}`,
    },
  ],
});

linker.link("Fix ENG-533 PR#42 INC-99", { for: "slack" });
// "Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533> <https://github.com/Fairmint/api/pull/42|PR#42> <https://incident.io/INC-99|INC-99>"
```

### LinkRule

Custom rules are small and direct: match text, map it to a URL, optionally set a priority.

```typescript
interface LinkRule {
  name?: string;
  match: RegExp;
  to: string | ((ctx: { text: string; groups: string[] }) => string);
  priority?: number;
}
```

## Markdown Utilities

Tools for working with markdown fences and formatting.

### codeBlock

Wraps content in a safe fenced code block and picks a longer fence automatically when needed.

```typescript
import { codeBlock } from "@hardlydifficult/text";

codeBlock("hello");
// "```\nhello\n```"

codeBlock("const x = 1;", "ts");
// "```ts\nconst x = 1;\n```"
```

### stripAnsi

Removes ANSI escape codes from strings.

```typescript
import { stripAnsi } from "@hardlydifficult/text";

stripAnsi("\x1b[31mRed\x1b[0m"); // "Red"
```

## License

MIT
