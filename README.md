# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages.

## Packages

| Package | Description |
|---------|-------------|
| [@hardlydifficult/chat](./packages/chat) | Unified chat API for Discord and Slack |
| [@hardlydifficult/document-generator](./packages/documentGenerator) | Platform-agnostic document builder |

## GitHub Actions Setup

Add an `NPM_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with an [npm automation token](https://www.npmjs.com/settings/~/tokens).

## Development

```bash
npm install
npm run build
npm run test
```
