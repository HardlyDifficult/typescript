# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages.

## Packages

| Package | Description |
|---------|-------------|
| [@hardlydifficult/chat](./packages/chat) | Unified chat API for Discord and Slack |
| [@hardlydifficult/ci-scripts](./packages/ci-scripts) | Reusable CI scripts |
| [@hardlydifficult/document-generator](./packages/document-generator) | Platform-agnostic document builder |
| [@hardlydifficult/state-tracker](./packages/state-tracker) | File-based state persistence for recovery across restarts |
| [@hardlydifficult/throttle](./packages/throttle) | Rate limiting utilities with optional state persistence |
| [@hardlydifficult/date-time](./packages/date-time) | Date and time utilities |

## GitHub Actions Setup

Add an `NPM_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with an [npm automation token](https://www.npmjs.com/settings/~/tokens).

## Development

```bash
npm install
npm run build
npm run test
```
