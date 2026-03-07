# @hardlydifficult/notion

Opinionated Notion client for markdown-first page workflows.

The default path is intentionally narrow:

- Create pages with a single draft object
- Pass normal JavaScript values for most properties
- Write content as markdown
- Hand the client anything with `toMarkdown()` when you use a document builder
- Reach for `notionProperty` only when Notion needs a more specific value shape

## Install

```bash
npm install @hardlydifficult/notion
```

## Setup

1. Create a Notion integration at [notion.so/profile/integrations](https://www.notion.so/profile/integrations)
2. Copy the internal integration token
3. Share the relevant pages, databases, or data sources with that integration

## Recommended Usage

### Create a page

```typescript
import { Document } from "@hardlydifficult/document-generator";
import {
  NotionClient,
  notionParent,
  notionProperty,
} from "@hardlydifficult/notion";

const notion = new NotionClient({
  apiToken: process.env.NOTION_API_TOKEN!,
});

const doc = new Document()
  .section("Goals", ["Lock scope", "Finalize launch date", "Ship cleanly"])
  .section("Notes", "Keep the process boring and obvious.");

const page = await notion.createPage({
  parent: notionParent.database("52aca6445f5c4e70b758324f99014fcd"),
  title: "Q2 Launch Plan",
  properties: {
    Status: notionProperty.status("In Progress"),
    Score: 42,
    Notes: "Created from the SDK",
    Tags: ["launch", "marketing"],
    DueDate: new Date("2026-03-20T00:00:00.000Z"),
  },
  content: doc,
});

console.log(page.url);
```

### Create a child page

No placeholder properties object is needed.

```typescript
await notion.createPage(
  notionParent.page("01234567-89ab-cdef-0123-456789abcdef"),
  "# Planning Notes\n\n- Draft agenda\n- Review action items"
);
```

### Read a page

`readPage()` tries markdown first and falls back to block traversal automatically when Notion does not support markdown retrieval for that page/version combination.

```typescript
const page = await notion.readPage("01234567-89ab-cdef-0123-456789abcdef");

console.log(page.title);
console.log(page.markdown);
```

### Append or replace page markdown

```typescript
await notion.appendPageMarkdown(
  "01234567-89ab-cdef-0123-456789abcdef",
  "## Follow-up\n\nAdded from the API."
);

await notion.replacePageMarkdown(
  "01234567-89ab-cdef-0123-456789abcdef",
  doc
);
```

### Update page properties

```typescript
await notion.updatePageProperties("01234567-89ab-cdef-0123-456789abcdef", {
  Status: notionProperty.status("Done"),
  Estimate: 5,
  Notes: "Ready for handoff",
  Tags: ["launch", "closed"],
  Published: true,
});
```

## Plain Property Rules

These are the defaults the client applies when you pass plain values:

- `string` -> `rich_text`
- `number` -> `number`
- `boolean` -> `checkbox`
- `Date` -> `date`
- `string[]` -> `multi_select`

Use `notionProperty` when you need a Notion-specific type:

- `notionProperty.title("Page title")`
- `notionProperty.select("Planned")`
- `notionProperty.status("In Progress")`
- `notionProperty.date("2026-03-20")`
- `notionProperty.url("https://example.com")`
- `notionProperty.email("team@example.com")`
- `notionProperty.phoneNumber("+1-555-555-5555")`
- `notionProperty.relation("page-id-1", "page-id-2")`
- `notionProperty.people("user-id-1", "user-id-2")`

Use `null` with `select`, `status`, `date`, `number`, `url`, `email`, or `phoneNumber` to clear those values.

## Title Default

When you call `createPage({ title: "..." })`, the client writes that title to a property named `Name`.

If your database uses a different title property, set it explicitly:

```typescript
await notion.createPage({
  parent: notionParent.database("database-id"),
  titleProperty: "Task",
  title: "Ship launch plan",
  content: "# Context\n\n...",
});
```

## Document Builder Integration

Any value with a `toMarkdown(): string` method is accepted anywhere the client expects markdown.

That means `@hardlydifficult/document-generator` documents work directly without extra adapters:

```typescript
await notion.appendPageMarkdown(pageId, doc);
await notion.replacePageMarkdown(pageId, doc);
await notion.createPage({
  parent: notionParent.page(parentPageId),
  title: "Daily Report",
  content: doc,
});
```

## Strong Defaults

- Markdown-first reads and writes
- Automatic markdown-read fallback to blocks when the failure is markdown-specific
- Automatic 100-block batching for block appends and oversized page creation
- Clean page creation without raw Notion transport payloads in client code

## API

### `new NotionClient({ apiToken, fetchImpl?, apiVersion? })`

Creates an authenticated client. `apiVersion` defaults to `2022-06-28` for legacy compatibility. Markdown-specific operations automatically use `2025-09-03`.

### `notion.createPage({ parent, title?, titleProperty?, properties?, content?, blocks? })`

Recommended page creation API.

- `title` writes to `Name` by default
- `content` accepts markdown or any `toMarkdown()` object
- `blocks` is the escape hatch when you need to send raw Notion blocks

### `notion.createPage(parent, content)` and `notion.createPage(parent, properties, content?)`

Compatibility overloads for shorter calls and existing clients.

### `notion.readPage(pageId, options?)`

Returns normalized page metadata plus markdown content.

### `notion.appendPageMarkdown(pageId, markdown, options?)`

Appends markdown content to a page.

### `notion.replacePageMarkdown(pageId, markdown, options?)`

Replaces existing page content. The client derives a content range automatically unless you pass one explicitly.

### `notion.updatePageProperties(pageId, properties)`

Updates one or more properties on a page. Plain JS values are normalized automatically.

### `notion.searchPages(query, options?)`

Searches for pages and returns normalized results.

### `notion.getActivityFeed(options?)`

Builds a recent activity timeline from page edits and page-level comments.

## Advanced Compatibility

The package still accepts raw Notion property payloads and still exposes lower-level methods like `createPageMarkdown()`, `updatePage()`, and `updatePageMarkdown()` for compatibility.

Use them only when you intentionally need raw Notion API control. For normal client code, prefer the page-draft path above.
