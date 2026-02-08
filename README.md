# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages.

## Packages

| Package | Description |
|---------|-------------|
| [@hardlydifficult/chat](./packages/chat) | Unified chat API for Discord and Slack |
| [@hardlydifficult/ci-scripts](./packages/ci-scripts) | Reusable CI scripts |
| [@hardlydifficult/date-time](./packages/date-time) | Date and time utilities |
| [@hardlydifficult/document-generator](./packages/document-generator) | Platform-agnostic document builder |
| [@hardlydifficult/github](./packages/github) | Typed GitHub API client (Octokit wrapper) |
| [@hardlydifficult/poller](./packages/poller) | Generic state-change poller with interval polling |
| [@hardlydifficult/shared-config](./packages/shared-config) | Shared config files synced via postinstall |
| [@hardlydifficult/state-tracker](./packages/state-tracker) | File-based state persistence for recovery across restarts |
| [@hardlydifficult/throttle](./packages/throttle) | Rate limiting utilities with optional state persistence |
| [@hardlydifficult/ts-config](./packages/ts-config) | Shared ESLint, Prettier, and TypeScript config |

## GitHub Actions Setup

Add an `NPM_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with an [npm automation token](https://www.npmjs.com/settings/~/tokens).

Add a `PAT_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with a [GitHub PAT](https://github.com/settings/tokens) that has `repo` scope. This is used by the CI auto-fix workflow to push commits that trigger re-runs.

## Development

```bash
npm install
npm run build
npm run test
```
