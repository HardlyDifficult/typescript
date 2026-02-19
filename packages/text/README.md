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
} from "@hardlydifficult/text";

// Template replacement
const greeting = replaceTemplate("Hello {{name}}!", { name: "Alice" });
// "Hello Alice!"

// Split long text into chunks
const chunks = chunkText("Line 1\nLine 2\nLine 3", 10);
// ["Line 1\nLine 2", "Line 3"]

// Convert to URL-safe slug
const slug = slugify("My Feature Name!", 10);
// "my-feature"

// Format duration in ms
const formatted = formatDuration(125_000);
// "2m 5s"

// Build a file tree
const tree = buildFileTree(["src/index.ts", "src/utils.ts", "README.md"]);
// src/
//   index.ts
//   utils.ts
//
// README.md

// Convert between JSON/YAML
const yaml = convertFormat('{"name":"Alice"}', "yaml");
// name: Alice
```

## Error Handling

Consistent error extraction and formatting utilities.

```typescript
import { getErrorMessage, formatError, formatErrorForLog } from "@hardlydifficult/text";

const err = new Error("disk full");

getErrorMessage(err); // "disk full"
formatError(err, "Failed to save"); // "Failed to save: disk full"
formatErrorForLog(err); // "disk full"
```

### Functions

| Function | Description |
|----------|-------------|
| `getErrorMessage(err)` | Extract message string from unknown error |
| `formatError(err, context?)` | Format error with optional context prefix |
| `formatErrorForLog(err)` | Format error for logging (non-Error → string) |

## Template Replacement

Simple string interpolation using `{{variable}}` syntax.

```typescript
import { replaceTemplate, extractPlaceholders } from "@hardlydifficult/text";

const text = replaceTemplate("Hello {{name}}! You are {{age}}.", {
  name: "Alice",
  age: "30",
});
// "Hello Alice! You are 30."

const vars = extractPlaceholders("{{greeting}}, {{name}}!");
// ["greeting", "name"]
```

### Functions

| Function | Description |
|----------|-------------|
| `replaceTemplate(template, values)` | Replace all `{{variable}}` placeholders |
| `extractPlaceholders(template)` | Return unique placeholder names |

## Text Chunking

Split long text into manageable chunks respecting natural breaks.

```typescript
import { chunkText } from "@hardlydifficult/text";

const text = "line one\nline two\nline three";
chunkText(text, 18);
// ["line one\nline two", "line three"]
```

### Behavior

- Breaks on newlines first, then spaces
- Falls back to hard breaks when no natural break point exists
- Trims leading whitespace from subsequent chunks

## Slugification

Convert strings to URL/filename-safe slugs.

```typescript
import { slugify } from "@hardlydifficult/text";

slugify("My Feature Name!"); // "my-feature-name"
slugify("My Feature Name!", 10); // "my-feature"
```

### Features

- Lowercases and replaces non-alphanumeric runs with single hyphens
- Trims leading/trailing hyphens
- Optional `maxLength` truncates at hyphen boundary when possible

## Duration Formatting

Format milliseconds as human-readable duration strings.

```typescript
import { formatDuration } from "@hardlydifficult/text";

formatDuration(125_000); // "2m 5s"
formatDuration(3_600_000); // "1h"
formatDuration(500); // "<1s"
```

### Format Rules

| Duration | Output |
|----------|--------|
| < 1000ms | `<1s` |
| 1–59 seconds | `<seconds>s` |
| 1–59 minutes | `<minutes>m` or `<minutes>m <seconds>s` |
| 1–23 hours | `<hours>h` or `<hours>h <minutes>m` |
| ≥ 1 day | `<days>d` or `<days>d <hours>h` |

## File Tree Rendering

Build and render hierarchical file trees with depth-based truncation and annotations.

```typescript
import { buildFileTree, FILE_TREE_DEFAULTS } from "@hardlydifficult/text";
import type { BuildTreeOptions } from "@hardlydifficult/text";

const paths = [
  "src/index.ts",
  "test/unit/a.test.ts",
  "test/unit/b.test.ts",
];

const options: BuildTreeOptions = {
  maxLevel2: 2,
  annotations: new Map([["src/index.ts", "Entry point"]]),
  collapseDirs: ["test"],
};

buildFileTree(paths, options);
// src/
//   index.ts — Entry point
//
// test/
//   (2 files across 1 dir)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxLevel2` | `number` | 10 | Max children to show at depth 2 (top-level dirs) |
| `maxLevel3` | `number` | 3 | Max children to show at depth 3 (files/dirs inside top dirs) |
| `annotations` | `Map<string, string>` | `undefined` | File/dir descriptions |
| `details` | `Map<string, string[]>` | `undefined` | Extra lines to show under file entries |
| `collapseDirs` | `string[]` | `undefined` | Directory names to collapse and summarize |

## Format Conversion

Convert text between JSON and YAML with auto-detection.

```typescript
import { convertFormat } from "@hardlydifficult/text";
import type { TextFormat } from "@hardlydifficult/text";

// JSON to YAML
convertFormat('{"name":"Alice"}', "yaml");
// name: Alice

// YAML to JSON (pretty-printed with 2-space indent)
convertFormat("name: Alice\nage: 30", "json");
// {
//   "name": "Alice",
//   "age": 30
// }
```

### Functions

| Function | Description |
|----------|-------------|
| `convertFormat(content, to)` | Parse input and re-serialize to `json` or `yaml` |

## YAML Formatting

Serialize data to clean YAML, using block literals for long strings containing `: `.

```typescript
import { formatYaml } from "@hardlydifficult/text";

formatYaml({
  purpose:
    "Core AI SDK: LLM integrations (Anthropic, Ollama) and streaming support.",
});
// purpose: |
//   Core AI SDK: LLM integrations (Anthropic, Ollama) and streaming support.
```

### Behavior

- Long strings (`>60 chars`) containing `: ` render as block literals (`|`)
- Short strings and safe scalars remain plain or quoted as needed
- Preserves round-trip parseability

## YAML Healing

Sanitize malformed YAML from LLMs by stripping code fences and quoting scalar values containing colons.

```typescript
import { healYaml } from "@hardlydifficult/text";
import { parse } from "yaml";

const badYaml = `\`\`\`yaml
purpose: |
  Core AI: LLM integrations (Anthropic, Ollama)
description: Main deps: Node, TypeScript, Vitest.
\`\`\``;

const cleaned = healYaml(badYaml);
// purpose: |
//   Core AI: LLM integrations (Anthropic, Ollama)
// description: "Main deps: Node, TypeScript, Vitest."

parse(cleaned); // Parses successfully
```

### Fixes Applied

- Strips markdown code fences (` ```yaml ` or ` ``` `)
- Quotes plain scalar values containing `: ` to avoid parse errors

## Linkification

Transform text with issue/PR references into formatted links.

```typescript
import { createLinker } from "@hardlydifficult/text";

const linker = createLinker()
  .linear("fairmint")
  .githubPr("Fairmint/api");

const output = linker.apply("Fix ENG-533 and PR#42", { platform: "slack" });
// Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533> <https://github.com/Fairmint/api/pull/42|PR#42>
```

### Platforms

| Platform | Output Format |
|----------|---------------|
| `slack` | `<href\|text>` |
| `discord` | `[text](href)` |
| `markdown` | `[text](href)` |
| `plaintext` | `href` (raw URL) |

### Linker Methods

| Method | Description |
|--------|-------------|
| `custom(pattern, toHref, options)` | Register a new rule with regex pattern and href builder |
| `linear(workspace, options)` | Match `PROJECT-123` and link to Linear |
| `githubPr(repository, options)` | Match `PR#123` and link to GitHub Pull Request |
| `apply(text, options)` | Transform text with configured rules |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` / `platform` | `LinkerPlatform` | `"markdown"` | Output format |
| `skipCode` | `boolean` | `true` | Skip linkification inside code blocks/inline code |
| `skipExistingLinks` | `boolean` | `true` | Skip linkification inside existing links |

### LinkRule Options

| Property | Type | Description |
|----------|------|-------------|
| `pattern` | `RegExp` | Match pattern (global matching enforced) |
| `href` / `toHref` | `string` or `LinkHrefBuilder` | URL template (supports `$0`/`$&`, `$1`..`$N`) or callback |
| `priority` | `number` | `0` | Higher priority wins overlapping matches |

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

## Markdown Fence Escaping

Escape content by wrapping with more backticks than contained in the content.

```typescript
import { escapeFence } from "@hardlydifficult/text";

const result = escapeFence("content with ``` triple backticks");
// { fence: "````", content: "content with ``` triple backticks" }

// Use as:
// ${result.fence}${result.content}${result.fence}
```