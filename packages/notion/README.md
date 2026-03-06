# @hardlydifficult/notion

Notion API client for page creation, reading, search, markdown updates, and block conversion.

## Install

```bash
npm install @hardlydifficult/notion
```

## Setup

### 1. Create a Notion integration

1. Go to [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations) and click **New integration**
2. Give it a name, select your workspace, and click **Save**
3. Copy the **Internal Integration Token**

### 2. Share the integration with the content you want to access

For databases, pages, and data sources, open the item in Notion and connect the integration from the share or connection menu.

### 3. Find the relevant IDs

- Database IDs and page IDs are the 32-character hex strings in Notion URLs
- Data source IDs are available from the Notion API when using newer multi-source databases

## Features

- Create pages in databases, data sources, pages, or the workspace root
- Read page metadata and markdown content
- Search pages by query
- Update page markdown content or properties
- Append blocks with automatic batching
- Retrieve page blocks recursively
- Convert markdown to Notion blocks and blocks back to markdown
- Work with richer block types such as headings, lists, to-dos, quotes, toggles, callouts, code blocks, dividers, media blocks, bookmarks, embeds, equations, synced blocks, and table of contents blocks

## Usage

### Create a database page

```typescript
import { NotionClient } from "@hardlydifficult/notion";

const notion = new NotionClient({ apiToken: process.env.NOTION_API_TOKEN! });

const page = await notion.createPage(
  "52aca6445f5c4e70b758324f99014fcd",
  {
    Name: { title: [{ type: "text", text: { content: "My page title" } }] },
    Status: { status: { name: "Done" } },
    Score: { number: 42 },
    Notes: {
      rich_text: [{ type: "text", text: { content: "Created from the SDK" } }],
    },
  },
  "## Details\n\nLong body text goes here."
);

console.log(page.url);
```

### Create a child page from markdown

```typescript
const childPage = await notion.createPage(
  { type: "page_id", page_id: "01234567-89ab-cdef-0123-456789abcdef" },
  {},
  "# Planning Notes\n\n- Draft agenda\n- Review action items"
);
```

### Read a page

```typescript
const page = await notion.readPage("01234567-89ab-cdef-0123-456789abcdef");

console.log(page.title);
console.log(page.markdown);
```

### Search pages

```typescript
const results = await notion.searchPages("planning", { limit: 10 });

for (const result of results) {
  console.log(result.title, result.url);
}
```

### Append or replace page content

```typescript
await notion.updatePage(
  "01234567-89ab-cdef-0123-456789abcdef",
  "## Follow-up\n\nAdded from the API."
);

await notion.updatePage(
  "01234567-89ab-cdef-0123-456789abcdef",
  "# Rewritten page\n\nFresh content.",
  { replace: true }
);
```

### Update page properties

```typescript
await notion.updatePageProperties("01234567-89ab-cdef-0123-456789abcdef", {
  Status: { status: { name: "In Progress" } },
  Estimate: { number: 5 },
});
```

### Convert markdown and blocks

```typescript
import { blocksToMarkdown, markdownToBlocks } from "@hardlydifficult/notion";

const blocks = markdownToBlocks("## Title\n\n- one\n- two");
const markdown = blocksToMarkdown(blocks);
```

## API

### `new NotionClient({ apiToken, fetchImpl?, apiVersion? })`

Creates a client authenticated with the given integration token. `apiVersion` defaults to `2022-06-28` for legacy compatibility, while markdown-specific operations automatically use `2025-09-03`.

### `notion.createPage(parentOrDatabaseId, properties?, content?)`

Creates a page in a database, data source, page, or workspace.

- Backward compatible: passing a string still treats it as a legacy `database_id`
- `content` may be a markdown string or a list of blocks
- Markdown content for modern parent types uses Notion's markdown endpoint directly

### `notion.createPageMarkdown(parent, markdown, properties?)`

Creates a page with markdown content using Notion's markdown endpoint. Use this for `page_id`, `workspace`, or `data_source_id` parents.

### `notion.readPage(pageId, options?)`

Reads a page and returns metadata plus markdown content. Supports block-based fallback when markdown retrieval is unavailable.

### `notion.getPageMeta(pageId)`

Returns page metadata including title, URL, timestamps, and properties.

### `notion.searchPages(query, options?)`

Searches for pages and returns normalized page metadata results.

### `notion.updatePage(pageId, content, options?)`

Appends markdown content by default. With `{ replace: true }`, replaces existing content using Notion's markdown update endpoint.

### `notion.updatePageMarkdown(pageId, request)`

Low-level wrapper over the markdown update endpoint. Supports:

- `insert_content`
- `replace_content_range`

### `notion.updatePageProperties(pageId, properties)`

Updates page properties via the standard page update endpoint.

### `notion.archivePage(pageId, archived?)`

Archives or unarchives a page.

### `notion.appendBlocks(pageId, blocks)`

Appends blocks to an existing page, batching automatically in groups of 100.

### `notion.retrieveBlockChildren(blockId, options?)`

Retrieves block children, optionally recursively.

### `notion.getPageBlocks(pageId, options?)`

Convenience wrapper for retrieving a page's block tree.

### `notion.markdownToBlocks(markdown)` and `markdownToBlocks(markdown)`

Converts common markdown structures into Notion block payloads.

### `notion.blocksToMarkdown(blocks)` and `blocksToMarkdown(blocks)`

Converts supported Notion block payloads back to markdown.

### `NotionClient.buildSectionBlocks(heading, body)`

Static helper that returns a `heading_2` block followed by paragraph blocks for the body text, split into 2,000-character chunks.

## Notes

- The conversion helpers cover common writing and planning content well, but Notion's full content model is larger than the subset wrapped here.
- Legacy database creation remains supported for compatibility.
- Markdown create and update flows use the newer Notion API version automatically.
