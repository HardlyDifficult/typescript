# @hardlydifficult/document-generator

Platform-agnostic document builder with chainable API and multi-format output (Markdown, Slack, plain text).

## Installation

```bash
npm install @hardlydifficult/document-generator
```

## Quick Start

```typescript
import { Document } from "@hardlydifficult/document-generator";

const doc = new Document({
  header: "Release Notes",
  sections: [
    { title: "New Features", content: "Ship onboarding flow\nFix retry bug" },
  ],
  context: { Network: "mainnet", Status: "active" },
});

console.log(doc.toMarkdown());
// # Release Notes
//
// **New Features**
// Ship onboarding flow
// Fix retry bug
//
// ---
//
// *Network: mainnet, Status: active*

console.log(doc.toSlack());
// *Release Notes*
//
// **New Features**
// Ship onboarding flow
// Fix retry bug
//
// ────────────────
//
// Network: mainnet, Status: active
```

## Core Document API

The `Document` class provides a fluent, chainable builder for structured content.

### Constructor

Creates a new document, optionally initialized with header, sections, and context.

```typescript
const doc = new Document({
  header: "My Report",
  sections: [
    { title: "Summary", content: "All systems operational" },
    { content: "No issues found" },
  ],
  context: { Network: "mainnet", Status: "active" },
});
```

### Block Methods

These methods add specific block types and return `this` for chaining.

```typescript
const doc = new Document()
  .header("Title")
  .text("Content")
  .list(["Item 1", "Item 2"])
  .divider()
  .context("Context text")
  .link("Visit Site", "https://example.com")
  .code("const x = 1;")
  .image("https://example.com/image.png", "Alt text");
```

### Convenience Methods

#### `section(title, content?, options?)`

Renders section titles as bold with optional content.

```typescript
doc.section("Summary").text("All systems green");
// Output: **Summary**\nAll systems green

doc.section("Today", ["Ship onboarding", "Fix flaky test"]);
// Output: **Today**\n- Ship onboarding\n- Fix flaky test

doc.section("Blockers", [], { emptyText: "None." });
// Output: **Blockers**\n- None.
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `emptyText` | `string` | _none_ | Fallback when content is empty |
| `ordered` | `boolean` | `false` | Render list as numbered instead of bullets |
| `divider` | `boolean` | `false` | Insert divider before section output |

#### `field(label, value, options?)`

Renders a single key-value pair.

```typescript
doc.field("ETA", "Tomorrow");
// Output: **ETA:** Tomorrow

doc.field("Blockers", "", { emptyText: "None." });
// Output: **Blockers:** None.
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `emptyText` | `string` | _none_ | Fallback when value is empty |
| `separator` | `string` | `":"` | Separator between label and value |
| `bold` | `boolean` | `true` | Whether to bold the label |

#### `keyValue(data, options?)`

Formats an object as key-value lines.

```typescript
doc.keyValue({ Name: "Alice", Role: "Admin" });
// Output: **Name:** Alice\n**Role:** Admin

doc.keyValue({ A: "1", B: "2" }, { style: "bullet" });
// Output: • **A**: 1\n• **B**: 2
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `style` | `"plain" \| "bullet" \| "numbered"` | `"plain"` | List style |
| `separator` | `string` | `":"` | Key-value separator |
| `bold` | `boolean` | `true` | Bold the keys |

#### `truncatedList(items, options?)`

Renders a list with automatic truncation.

```typescript
doc.truncatedList(["a", "b", "c", "d", "e"], { limit: 3 });
// Output:
// • a
// • b
// • c
// _... and 2 more_
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | `number` | `10` | Maximum items to show |
| `format` | `(item, index) => string` | `String` | Custom formatter |
| `moreText` | `(remaining) => string` | `_... and N more_` | Truncation text |
| `ordered` | `boolean` | `false` | Numbered list |

#### `timestamp(options?)`

Adds a timestamp in context format.

```typescript
doc.timestamp(); // 🕐 2024-02-04T12:00:00.000Z
doc.timestamp({ emoji: false }); // 2024-02-04T12:00:00.000Z
doc.timestamp({ label: "Generated" }); // Generated 2024-02-04T...
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `date` | `Date` | `new Date()` | Custom date |
| `emoji` | `boolean` | `true` | Include clock emoji |
| `label` | `string` | _none_ | Prefix label |

### Utility Methods

#### `linkify(transform, options?)`

Applies transformations to text-bearing blocks (headers, paragraphs, lists, context).

```typescript
doc.linkify((text) => text.toUpperCase());

// Example with linkText-style transformer:
doc.linkify({ linkText: (t) => t.replace("ENG-533", "LINKED") }, { platform: "slack" });
```

#### `isEmpty(): boolean`

Returns `true` if no blocks have been added.

```typescript
new Document().isEmpty(); // true
new Document().text("Content").isEmpty(); // false
```

#### `clone(): Document`

Creates a shallow copy.

```typescript
const doc1 = new Document().header("Title");
const doc2 = doc1.clone();
doc2.text("Extra"); // does not affect doc1
```

#### `getBlocks(): Block[]`

Returns the internal blocks array for inspection.

```typescript
const blocks = new Document().header("Title").getBlocks();
// [{ type: "header", text: "Title" }]
```

### Output Methods

Render the document to different formats.

```typescript
const doc = new Document().text("Hello **world**");

doc.toMarkdown(); // "**world**" preserved
doc.toSlack(); // "*world*" (italic)
doc.toPlainText(); // "world" (stripped)
doc.render("slack"); // same as toSlack()
```

## Direct Outputter Functions

Use the outputters directly without `Document` if you have raw blocks.

```typescript
import { toMarkdown, toPlainText, toSlackText } from "@hardlydifficult/document-generator";

const blocks = [
  { type: "header", text: "Title" },
  { type: "text", content: "Body with **bold**" },
];

console.log(toMarkdown(blocks)); // # Title\n\nBody with **bold**
console.log(toSlackText(blocks)); // *Title*\n\nBody with *bold*
console.log(toPlainText(blocks)); // TITLE\n\nBody with bold
```

## Markdown Conversion

### `convertMarkdown(text, platform)`

Converts inline markdown formatting to target platform syntax.

```typescript
convertMarkdown("**bold** and *italic*", "slack"); // "*bold* and _italic_"
convertMarkdown("~~strike~~", "discord"); // "~~strike~~"
convertMarkdown("**bold**", "plaintext"); // "bold"
```

Supported platforms: `"markdown"`, `"slack"`, `"discord"`, `"plaintext"`

### `stripMarkdown(text)`

Strips all formatting and returns plain text.

```typescript
stripMarkdown("**bold** and *italic* and ~~strike~~"); // "bold and italic and strike"
```

## Block Types

Internal block structure for advanced use cases:

```typescript
type Block =
  | { type: 'header'; text: string }
  | { type: 'text'; content: string }
  | { type: 'list'; items: string[] }
  | { type: 'divider' }
  | { type: 'context'; text: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'code'; content: string; multiline: boolean }
  | { type: 'image'; url: string; alt?: string };
```

## Types

All exported types are listed below:

| Name | Description |
|--|--|
| `Block` | Union type of all block types |
| `HeaderBlock`, `TextBlock`, `ListBlock`, `DividerBlock`, `ContextBlock`, `LinkBlock`, `CodeBlock`, `ImageBlock` | Block structures |
| `Platform` | `"markdown" \| "slack" \| "discord" \| "plaintext"` |
| `StringOutputFormat` | `"markdown" \| "slack" \| "plaintext"` |
| `DocumentOptions`, `DocumentSection` | Constructor options |
| `SectionOptions`, `FieldOptions`, `KeyValueOptions` | Formatting options |
| `TruncatedListOptions<T>` | Truncation configuration |
| `TimestampOptions` | Timestamp configuration |
| `DocumentLinkifier`, `DocumentLinkTransform`, `DocumentLinkifyOptions` | Link transformation types |

## Integration with @hardlydifficult/chat

Documents integrate seamlessly with the chat package for Slack and Discord:

```typescript
import { Document } from '@hardlydifficult/document-generator';
import { createChatClient } from '@hardlydifficult/chat';

const client = createChatClient({ type: 'slack' });
const channel = await client.connect(channelId);

const report = new Document()
  .header("Daily Metrics")
  .text("Here are today's **key numbers**:")
  .list(["Users: 1,234", "Revenue: $5,678", "Errors: 0"])
  .context("Generated automatically");

// Automatically converted to Slack Block Kit
await channel.postMessage(report);
```

## Appendix: Platform Differences

| Feature | Markdown | Slack | Plain Text |
|---------|---------|-------|-----------|
| **Bold** | `**text**` | `*text*` | text |
| *Italic* | `*text*` | `_text_` | text |
| ~~Strike~~ | `~~text~~` | `~text~` | text |
| Headers | `# Title` | `*Title*` | TITLE |
| Dividers | `---` | `────────────────` | `────────────────` |
| Links | `[text](url)` | `<url\|text>` | `text (url)` |
| Code (inline) | `` `code` `` | `` `code` `` | code |
| Code (block) | ` ```code``` ` | ` ```code``` ` | code |
| Images | `![alt](url)` | `Image: <url\|alt>` | `[Image: alt]` |