# @hardlydifficult/document-generator

Platform-agnostic document builder with chainable API and built-in output methods for Markdown, Slack mrkdwn, and plain text.

## Installation

```bash
npm install @hardlydifficult/document-generator
```

## Usage

```typescript
import { Document } from '@hardlydifficult/document-generator';

const doc = new Document()
  .header("Weekly Report")
  .text("Summary of this week's **key highlights**.")
  .list(["Completed feature A", "Fixed bug B", "Started project C"])
  .divider()
  .link("View details", "https://example.com")
  .context("Generated on 2025-01-15");

// Output as markdown
console.log(doc.toMarkdown());
// # Weekly Report
//
// Summary of this week's **key highlights**.
//
// - Completed feature A
// - Fixed bug B
// - Started project C
//
// ---
//
// [View details](https://example.com)
//
// *Generated on 2025-01-15*

// Output as Slack mrkdwn
console.log(doc.toSlack());
// *Weekly Report*
//
// Summary of this week's *key highlights*.
//
// • Completed feature A
// • Fixed bug B
// • Started project C
//
// ────────────────
//
// <https://example.com|View details>
//
// *Generated on 2025-01-15*

// Output as plain text
console.log(doc.toPlainText());
// WEEKLY REPORT
//
// Summary of this week's key highlights.
//
// • Completed feature A
// • Fixed bug B
// • Started project C
//
// ────────────────
//
// View details (https://example.com)
//
// Generated on 2025-01-15
```

## API

### `new Document(options?)`

Create a new document builder. All methods are chainable.

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `header` | `string` | Header/title for the document |
| `sections` | `DocumentSection[]` | Array of section definitions |
| `context` | `Record<string, string | number | boolean | undefined>` | Key-value pairs for footer/context |

**Example:**

```typescript
const doc = new Document({
  header: "Report",
  sections: [{ title: "Summary", content: "All systems green" }],
  context: { Status: "OK" }
});
```

### Core Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `header` | `header(text: string): this` | Add a header/title |
| `text` | `text(content: string): this` | Add text paragraph (supports **bold**, *italic*, ~~strike~~) |
| `list` | `list(items: string[]): this` | Add a bulleted list |
| `divider` | `divider(): this` | Add a horizontal divider |
| `context` | `context(text: string): this` | Add footer/context text |
| `link` | `link(text: string, url: string): this` | Add a hyperlink |
| `code` | `code(content: string): this` | Add code (auto-detects inline vs multiline) |
| `image` | `image(url: string, alt?: string): this` | Add an image |

**Example:**

```typescript
const doc = new Document()
  .header("Status Update")
  .text("The system is **operational** with *minor delays*.")
  .list(["User service OK", "Payment service OK", "Legacy API degraded"])
  .divider()
  .link("Dashboard", "https://example.com/dashboard")
  .context("Status as of 2025-01-15");
```

### Convenience Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `section` | `section(title: string, content?: SectionContent, options?: SectionOptions): this` | Add a section (legacy header+divider, or bold title + body/list) |
| `field` | `field(label: string, value: string \| number \| boolean \| undefined, options?: FieldOptions): this` | Add a single key-value line (e.g., `**ETA:** Tomorrow`) |
| `keyValue` | `keyValue(data: Record<string, string \| number \| boolean \| undefined>, options?: KeyValueOptions): this` | Add multiple key-value pairs |
| `truncatedList` | `truncatedList<T>(items: T[], options?: TruncatedListOptions<T>): this` | Add a list with automatic truncation |
| `timestamp` | `timestamp(options?: TimestampOptions): this` | Add a timestamp in context format |

#### `section(title, content?, options?)`

Add a section. Overloaded to support legacy behavior (header + divider) or structured content.

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `emptyText` | `string` | Fallback text shown when section content is empty |
| `ordered` | `boolean` | Render ordered list numbers instead of bullet markers |
| `divider` | `boolean` | Insert a divider before the section output |

**Examples:**

```typescript
// Legacy behavior: header + divider
doc.section("Overview");

// Structured: bold title + body text
doc.section("Summary", "All systems green");

// Structured: bold title + list
doc.section("Tasks", ["Task A", "Task B"]);

// With options: empty text for list sections
doc.section("Blockers", [], { emptyText: "None." });
```

#### `field(label, value, options?)`

Add a single key-value line.

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `emptyText` | `string` | Fallback value when the provided value is empty |
| `separator` | `string` | Separator placed between the label and value (default: `:`) |
| `bold` | `boolean` | Whether to bold the label (default: `true`) |

**Example:**

```typescript
doc.field("ETA", "Tomorrow");
// **ETA:** Tomorrow

doc.field("Blockers", "", { emptyText: "None." });
// **Blockers:** None.
```

#### `keyValue(data, options?)`

Add key-value pairs formatted as `**Key:** value`.

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `style` | `"plain"` \| `"bullet"` \| `"numbered"` | List style (default: `"plain"`) |
| `separator` | `string` | Separator between key and value (default: `:`) |
| `bold` | `boolean` | Whether to bold keys (default: `true`) |

**Examples:**

```typescript
doc.keyValue({ Network: "mainnet", Status: "active" });
// **Network:** mainnet
// **Status:** active

doc.keyValue({ Name: "Alice", Role: "Admin" }, { style: "bullet" });
// • **Name:** Alice
// • **Role:** Admin
```

#### `truncatedList(items, options?)`

Add a list with automatic truncation and "X more" message.

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `limit` | `number` | Maximum items to show (default: `10`) |
| `format` | `(item: T, index: number) => string` | Custom formatter for each item (default: `String(item)`) |
| `moreText` | `(remaining: number) => string` | Custom "more" text (default: `_... and N more_`) |
| `ordered` | `boolean` | Use numbered list instead of bullets (default: `false`) |

**Example:**

```typescript
doc.truncatedList(['a', 'b', 'c', 'd', 'e', 'f'], { limit: 3 });
// Output:
// • a
// • b
// • c
// _... and 3 more_
```

#### `timestamp(options?)`

Add a timestamp in context format.

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `date` | `Date` | Custom date to use (default: `new Date()`) |
| `emoji` | `boolean` | Include clock emoji (default: `true`) |
| `label` | `string` | Custom label text |

**Examples:**

```typescript
doc.timestamp(); // 🕐 2024-02-04T12:00:00.000Z
doc.timestamp({ emoji: false }); // 2024-02-04T12:00:00.000Z
doc.timestamp({ label: 'Generated' }); // Generated 2024-02-04T12:00:00.000Z
```

### String Output Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `toMarkdown` | `toMarkdown(): string` | Render as standard markdown |
| `toSlackText` | `toSlackText(): string` | Render as Slack mrkdwn string |
| `toSlack` | `toSlack(): string` | Alias for `toSlackText()` |
| `toPlainText` | `toPlainText(): string` | Render as plain text (markdown stripped) |
| `render` | `render(format: "markdown" \| "slack" \| "plaintext"): string` | Render via explicit format |

**Example:**

```typescript
const doc = new Document()
  .header("Title")
  .text("Body with **bold**");

console.log(doc.render("slack"));
// *Title*
//
// Body with *bold*
```

### `linkify(transform, options?)`

Apply linker-style transformations to text-bearing blocks (`header`, `text`, `list`, `context`) while leaving code and explicit `link` blocks unchanged.

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `platform` | `"markdown"` \| `"slack"` \| `"discord"` \| `"plaintext"` | Output platform passed to linker-style transformers (default: `"markdown"`) |

**Transform Signature:**

```typescript
type DocumentLinkTransform =
  | ((text: string) => string)
  | {
      linkText?: (text: string, options?: { platform?: Platform }) => string;
      apply?: (text: string, options?: { platform?: Platform }) => string;
    };
```

**Example:**

```typescript
import { createLinker } from "@hardlydifficult/text";

const linker = createLinker()
  .linear("fairmint")
  .githubPr("Fairmint/api");

const doc = new Document()
  .header("Sprint Update ENG-533")
  .text("Shipped ENG-533 and reviewed PR#42")
  .code("ENG-533 inside code is untouched")
  .link("PR", "https://github.com/Fairmint/api/pull/42")
  .linkify(linker, { platform: "slack" });
```

### Utility Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `isEmpty` | `isEmpty(): boolean` | Check if the document has no content |
| `clone` | `clone(): Document` | Create a shallow copy of the document |
| `getBlocks` | `getBlocks(): Block[]` | Get the internal block representation |

**Example:**

```typescript
const doc = new Document().text("Content");
console.log(doc.isEmpty()); // false
console.log(doc.clone().isEmpty()); // false
console.log(doc.getBlocks()); // [{ type: 'text', content: 'Content' }]
```

### Static Method

| Method | Signature | Description |
|--------|-----------|-------------|
| `truncate` | `static truncate(text: string, maxLength: number): string` | Truncate text to a maximum length with ellipsis |

**Example:**

```typescript
console.log(Document.truncate("hello world", 8)); // "hello..."
```

## Outputters (Free Functions)

For advanced use cases where you already have a `Block[]` array:

| Function | Signature | Description |
|----------|-----------|-------------|
| `toMarkdown` | `toMarkdown(blocks: Block[]): string` | Convert to standard markdown format |
| `toSlack` / `toSlackText` | `toSlack(blocks: Block[]): string` | Convert to Slack mrkdwn format |
| `toPlainText` | `toPlainText(blocks: Block[]): string` | Convert to plain text, stripping all formatting |

**Example:**

```typescript
import { Document, toSlack } from "@hardlydifficult/document-generator";

const blocks = new Document()
  .header("Status")
  .text("Operational")
  .getBlocks();

console.log(toSlack(blocks));
// *Status*
//
// Operational
```

## Block Types

Internal block types for custom processing:

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

## Inline Markdown Support

Text blocks support standard inline markdown that gets auto-converted per platform:

```typescript
new Document().text('This has **bold**, *italic*, and ~~strikethrough~~ text.');
```

- Standard markdown: `**bold**`, `*italic*`, `~~strike~~`
- Slack: Converted to `*bold*`, `_italic_`, `~strike~`
- Discord: Uses standard markdown (no conversion needed)
- Plain text: Formatting stripped

**Note:** Use `.code()` and `.link()` methods for code and links—not markdown syntax.

## Code Blocks

The `.code()` method auto-detects format:

```typescript
// Single line → inline code
new Document().code('const x = 1');  // → `const x = 1`

// Multiline → code block
new Document().code('const x = 1;\nconst y = 2;');
// → ```
//   const x = 1;
//   const y = 2;
//   ```
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