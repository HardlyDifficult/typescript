# @hardlydifficult/call

Minimal CLI + SDK for submitting outbound calls and polling for completion.

## Install

```bash
npm install @hardlydifficult/call
```

## Quick start

```bash
export CALL_API_ENDPOINT="https://your-call-service.example.com"
export CALL_API_TOKEN="..."
npx @hardlydifficult/call "Quick update: PR is ready for review."
```

## Required environment variables

- `CALL_API_ENDPOINT`: base endpoint for the call API
- `CALL_API_TOKEN`: API token

## Optional environment variables

- `CALL_SYSTEM_PROMPT`: default system prompt
- `CALL_FIRST_MESSAGE`: default first message when not passed as CLI arg
- `CALL_SOURCE`: source identifier override

## Saving transcripts to Notion

Set these two env vars to automatically save each completed call to a Notion database:

- `NOTION_API_TOKEN`: your Notion integration token
- `NOTION_DATABASE_ID`: the ID of the Notion database to write to

Each saved page includes the source ID (as the title), call status, timestamp, summary, and full transcript.

### Getting your Notion API token

1. Go to [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations) and click **New integration**
2. Give it a name, select your workspace, and click **Save**
3. Copy the **Internal Integration Token** — this is your `NOTION_API_TOKEN`
4. Open the Notion database you want to write to, click **...** in the top-right, go to **Connect to**, and add your integration

### Getting your Notion database ID

The database ID is the 32-character hex string in the database URL:

```
https://www.notion.so/<database_id>?v=<view_id>
```

For example, given:

```
https://www.notion.so/52aca6445f5c4e70b758324f99014fcd?v=833ccc2b5f4e4b339e9a9d431c6ac3e7
```

The database ID is `52aca6445f5c4e70b758324f99014fcd`.

### Expected database schema

The integration writes these properties to each page:

| Property | Type | Value |
|----------|------|-------|
| Name | Title | Source ID of the call |
| Status | Select | `completed`, `failed`, or `timeout` |
| Date | Date | Timestamp when the call ended |
| Summary | Rich text | Transcript summary (if available) |

The full transcript is written into the page body under a **Transcript** heading.

## CLI usage

```bash
npx @hardlydifficult/call [message] [options]
```

Options:

- `--endpoint` (or `CALL_API_ENDPOINT`)
- `--api-token` (or `CALL_API_TOKEN`)
- `--first-message`, `-m`
- `--system-prompt`, `-p`
- `--source`, `-s`

Run `npx @hardlydifficult/call --help` for details.
