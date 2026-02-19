# @hardlydifficult/document-generator

Platform-agnostic document builder with chainable API and multi-format output (Markdown, Slack, plain text).

## Installation

```bash
npm install @hardlydifficult/document-generator
```

## Quick Start

```typescript
import { Document } from '@hardlydifficult/document-generator';

const document = new Document()
  .header("Weekly Report")
  .text("Summary of this week's **key highlights**.")
  .list(["Completed feature A", "Fixed bug B", "Started project C"])
  .divider()
  .link("View details", "https://example.com")
  .context("Generated on 2025-01-15");

// Output as markdown
console.log(document.toMarkdown());

// Output as Slack mrkdwn
console.log(document.toSlackText());

// Output as plain text
console.log(document.toPlainText());
```

## Core Blocks

Build documents by chaining block methods. All methods return `this` for fluent composition.

```typescript
const doc = new Document()
  .header("Title")                           // # Title
  .text("Paragraph with **bold** text")      // Supports inline markdown
  .list(["Item 1", "Item 2"])                // Bulleted list
  .divider()                                 // Horizontal line
  .link("Click here", "https://example.com") // Hyperlink
  .code("const x = 1;")                      // Inline or multiline code
  .image("https://example.com/img.png")      // Image with optional alt text
  .context("Footer text");                   // Italicized context
```

### Inline Markdown

Text blocks support standard markdown formatting that auto-converts per platform:

```typescript
new Document().text('This has **bold**, *italic*, and ~~strikethrough~~ text.');
```

- **Markdown/Discord:** `**bold**`, `*italic*`, `~~strike~~` (unchanged)
- **Slack:** Converts to `*bold*`, `_italic_`, `~strike~`
- **Plain text:** Formatting stripped, text only

## Structured Content

### Sections

Add titled sections with optional content (string or list of items):

```typescript
// Legacy style: header + divider
doc.section("My Section");

// With string content
doc.section("Summary", "All systems operational");

// With list items
doc.section("Today", ["Ship feature", "Fix bug", "Review PR"]);

// With empty state
doc.section("Blockers", [], { emptyText: "None." });

// Ordered list
doc.section("Steps", ["First", "Second"], { ordered: true });
```

### Fields and Key-Value Pairs

Add single or multiple key-value lines:

```typescript
// Single field
doc.field("ETA", "Tomorrow");
// Output: **ETA**: Tomorrow

// Multiple fields
doc.keyValue({ Network: "mainnet", Status: "active" });
// Output: **Network**: mainnet\n**Status**: active

// With styling options
doc.keyValue(
  { Name: "Alice", Role: "Admin" },
  { style: "bullet", separator: " =", bold: false }
);
// Output: • Name = Alice\n• Role = Admin
```

### Truncated Lists

Display a limited number of items with an "X more" indicator:

```typescript
doc.truncatedList(
  ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"],
  { limit: 3 }
);
// Output:
// • Item 1
// • Item 2
// • Item 3
// _... and 2 more_

// Custom formatting
const users = [{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }];
doc.truncatedList(users, {
  limit: 2,
  format: (u) => u.name,
  moreText: (n) => `Plus ${n} others`,
  ordered: true
});
```

### Timestamps

Add ISO timestamps with optional emoji and label:

```typescript
doc.timestamp();
// Output: 🕐 2024-02-04T12:00:00.000Z

doc.timestamp({ emoji: false });
// Output: 2024-02-04T12:00:00.000Z

doc.timestamp({ label: "Generated" });
// Output: Generated 2024-02-04T12:00:00.000Z

doc.timestamp({ date: new Date("2025-01-01") });
// Output: 🕐 2025-01-01T00:00:00.000Z
```

## Output Formats

Convert documents to different formats with a single method call:

```typescript
const doc = new Document()
  .header("Report")
  .text("Status: **active**");

doc.toMarkdown();   // # Report\n\nStatus: **active**
doc.toSlackText();  // *Report*\n\nStatus: *active*
doc.toSlack();      // Alias for toSlackText()
doc.toPlainText();  // REPORT\n\nStatus: active

// Or use render() with explicit format
doc.render("markdown");   // Standard markdown
doc.render("slack");      // Slack mrkdwn
doc.render("plaintext");  // Plain text
```

## Linkification

Transform text in document blocks (headers, paragraphs, lists, context) while preserving code and explicit links:

```typescript
import { Document } from "@hardlydifficult/document-generator";

const doc = new Document()
  .header("Sprint ENG-533")
  .text("Shipped ENG-533 and reviewed PR#42")
  .code("ENG-533 inside code is untouched")
  .link("PR", "https://github.com/example/pull/42");

// Simple function transformer
doc.linkify((text) => text.replace("ENG-533", "[ENG-533](...)"));

// Linker-style object with platform awareness
doc.linkify(
  {
    linkText: (text, { platform }) => {
      if (text.includes("ENG-")) {
        return `[${text}](https://linear.app/...)`;
      }
      return text;
    }
  },
  { platform: "slack" }
);
```

## Constructor Options

Initialize a document with pre-populated content:

```typescript
const doc = new Document({
  header: "Daily Report",
  sections: [
    { title: "Summary", content: "All systems operational" },
    { content: "No blockers" }
  ],
  context: { Network: "mainnet", Status: "active" }
});
```

## Utility Methods

### `isEmpty()`

Check if document has no blocks:

```typescript
const doc = new Document();
doc.isEmpty(); // true

doc.text("Content");
doc.isEmpty(); // false
```

### `clone()`

Create a shallow copy of the document:

```typescript
const original = new Document().header("Title").text("Content");
const copy = original.clone();

copy.text("Added to copy");
// original still has 2 blocks, copy has 3
```

### `getBlocks()`

Access the raw block array for custom processing:

```typescript
const blocks = doc.getBlocks();
// blocks: Block[]
```

### `Document.truncate(text, maxLength)`

Static utility to truncate text with ellipsis:

```typescript
Document.truncate("Hello world", 8); // "Hello..."
Document.truncate("Hi", 10);         // "Hi"
```

## Direct Outputter Functions

For cases where you already have a `Block[]` array, use outputter functions directly:

```typescript
import { toMarkdown, toSlackText, toPlainText } from '@hardlydifficult/document-generator';

const blocks = [
  { type: 'header', text: 'Title' },
  { type: 'text', content: 'Body' }
];

toMarkdown(blocks);   // # Title\n\nBody\n\n
toSlackText(blocks);  // *Title*\n\nBody\n\n
toPlainText(blocks);  // TITLE\n\nBody\n\n
```

## Markdown Conversion Utilities

Convert or strip markdown formatting for custom outputters:

```typescript
import { convertMarkdown, stripMarkdown } from '@hardlydifficult/document-generator';

// Convert to platform-specific format
convertMarkdown("**bold** and *italic*", "slack");
// → "*bold* and _italic_"

convertMarkdown("**bold** and *italic*", "markdown");
// → "**bold** and *italic*"

// Strip all markdown
stripMarkdown("**bold** and *italic*");
// → "bold and italic"
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
|---------|----------|-------|-----------|
| **Bold** | `**text**` | `*text*` | text |
| *Italic* | `*text*` | `_text_` | text |
| ~~Strike~~ | `~~text~~` | `~text~` | text |
| Headers | `# Title` | `*Title*` | TITLE |
| Dividers | `---` | `────────────────` | `────────────────` |
| Links | `[text](url)` | `<url\|text>` | `text (url)` |
| Code (inline) | `` `code` `` | `` `code` `` | code |
| Code (block) | ` ```code``` ` | ` ```code``` ` | code |
| Images | `![alt](url)` | `Image: <url\|alt>` | `[Image: alt]` |