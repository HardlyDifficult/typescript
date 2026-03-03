# @hardlydifficult/call

Simple CLI + SDK for submitting outbound Cowork calls and polling for completion.

## Install

```bash
npm install @hardlydifficult/call
```

## Quick start

```bash
export COWORK_API_KEY="..."
npx @hardlydifficult/call "Quick update: PR is ready for review."
```

The command uses sane defaults and will:

- Submit a call request to the Cowork endpoint
- Poll until terminal status (`completed`, `failed`, or `not-found`)
- Retry temporary network/API failures with exponential backoff
- Optionally fail over to fallback endpoints

## Environment defaults

- `COWORK_API_KEY`: API token (required unless `--api-key` passed)
- `COWORK_BOT_URL`: primary endpoint (default: `https://ai-bot-skpe.onrender.com`)
- `COWORK_BOT_URL_FALLBACKS`: comma-separated fallback URLs
- `COWORK_SYSTEM_PROMPT`: default system prompt
- `COWORK_TIMEOUT_SECONDS`: poll timeout (default: `600`)
- `COWORK_POLL_INTERVAL_SECONDS`: poll interval (default: `10`)
- `COWORK_REQUEST_TIMEOUT_SECONDS`: per-request timeout (default: `20`)
- `COWORK_MAX_RETRIES`: retries per request (default: `6`)
- `COWORK_RETRY_BASE_MS`: base retry delay in ms (default: `500`)
- `COWORK_MAX_RETRY_DELAY_MS`: max retry delay cap in ms (default: `10000`)

## CLI usage

```bash
npx @hardlydifficult/call [message] [options]
```

Common options:

- `--first-message`, `-m`
- `--system-prompt`, `-p`
- `--api-key`
- `--bot-url`
- `--fallback-url` (repeatable)
- `--source`, `-s`
- `--poll-only`
- `--submit-only`
- `--json`

Run `npx @hardlydifficult/call --help` for full options.
