# @hardlydifficult/document-generator

Platform-agnostic document builder with chainable API and built-in output methods.

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

## API

### `new Document()`

Create a new document builder. All methods are chainable.

### Chainable Methods

| Method | Description |
|--------|-------------|
| `.header(text)` | Add a header/title |
| `.text(content)` | Add text paragraph (supports **bold**, *italic*, ~~strike~~) |
| `.list(items)` | Add a bulleted list |
| `.divider()` | Add a horizontal divider |
| `.context(text)` | Add footer/context text |
| `.link(text, url)` | Add a hyperlink |
| `.code(content)` | Add code (auto-detects inline vs multiline) |
| `.image(url, alt?)` | Add an image |
| `.section(title, content?, options?)` | Add a section (legacy header+divider, or bold title + body/list) |
| `.field(label, value, options?)` | Add a single key-value line (e.g., `**ETA:** Tomorrow`) |

### `document.getBlocks(): Block[]`

Get the internal block representation for custom processing.

### String Output Methods

| Method | Description |
|--------|-------------|
| `.toMarkdown()` | Render as standard markdown |
| `.toSlackText()` | Render as Slack mrkdwn string |
| `.toSlack()` | Alias for `.toSlackText()` |
| `.toPlainText()` | Render as plain text (markdown stripped) |
| `.render(format)` | Render via explicit format (`"markdown"`, `"slack"`, `"plaintext"`) |

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

## Outputters

### `toMarkdown(blocks): string`

Convert to standard markdown format.

### `toSlackText(blocks): string` / `toSlack(blocks): string`

Convert to Slack mrkdwn format.

### `toPlainText(blocks): string`

Convert to plain text, stripping all formatting.

Instance methods are recommended for typical usage; free outputter functions are useful when you already have a `Block[]` array.

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

## Linkifying Text Blocks

Apply an issue/PR linker to document text-bearing blocks (`header`, `text`, `list`, `context`) while leaving explicit `code` and `link` blocks unchanged.

```typescript
import { Document } from "@hardlydifficult/document-generator";
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

`linkify()` also accepts a simple `(text) => text` transformer function.

## Structured Sections and Fields

For status updates and standups, use `section` and `field` to keep client code concise:

```typescript
const detail = new Document()
  .section("Yesterday", ["Reviewed PR #42", "Fixed flaky test"])
  .section("Today", ["Ship ENG-533", "Pair on migration"])
  .section("Blockers", [], { emptyText: "None." })
  .field("ETA", "Tomorrow");
```
