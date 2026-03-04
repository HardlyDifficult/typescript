# @hardlydifficult/notion

Minimal Notion API client for creating and appending to database pages.

## Install

```bash
npm install @hardlydifficult/notion
```

## Setup

### 1. Create a Notion integration

1. Go to [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations) and click **New integration**
2. Give it a name, select your workspace, and click **Save**
3. Copy the **Internal Integration Token** — this is your API token

### 2. Connect the integration to your database

1. Open the Notion database you want to write to
2. Click **...** in the top-right corner
3. Go to **Connect to** and select your integration

### 3. Find your database ID

The database ID is the 32-character hex string in the database URL:

```
https://www.notion.so/<database_id>?v=<view_id>
```

For example, given:

```
https://www.notion.so/52aca6445f5c4e70b758324f99014fcd?v=833ccc2b5f4e4b339e9a9d431c6ac3e7
```

The database ID is `52aca6445f5c4e70b758324f99014fcd`.

## Usage

```typescript
import { NotionClient } from "@hardlydifficult/notion";

const notion = new NotionClient({ apiToken: process.env.NOTION_API_TOKEN });

const page = await notion.createPage(
  process.env.NOTION_DATABASE_ID,
  {
    Name: { title: [{ type: "text", text: { content: "My page title" } }] },
    Status: { select: { name: "completed" } },
    Date: { date: { start: new Date().toISOString() } },
    Summary: { rich_text: [{ type: "text", text: { content: "Brief summary" } }] },
  },
  NotionClient.buildTranscriptBlocks("Full transcript text goes here...")
);

console.log(page.url);
```

## API

### `new NotionClient({ apiToken, fetchImpl? })`

Creates a client authenticated with the given Notion integration token.

### `notion.createPage(databaseId, properties, bodyBlocks?)`

Creates a new page in the specified database. Property keys must match the database schema. Long body content is automatically split and appended in batches to respect Notion's 2,000-character-per-block and 100-blocks-per-request limits.

### `NotionClient.buildTranscriptBlocks(transcript)`

Static helper that returns a `heading_2` block ("Transcript") followed by paragraph blocks containing the text, split into 2,000-character chunks.

### `notion.appendBlocks(pageId, blocks)`

Appends blocks to an existing page, batching automatically.
