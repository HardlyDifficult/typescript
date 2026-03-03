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
