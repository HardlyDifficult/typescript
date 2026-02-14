# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages.

[API Docs](https://hardlydifficult.github.io/typescript/) | [llms.txt](https://hardlydifficult.github.io/typescript/llms.txt)

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
| [@hardlydifficult/workflow-engine](./packages/workflow-engine) | State machine with typed statuses, validated transitions, and persistence |

## Documentation

API docs are auto-generated with [TypeDoc](https://typedoc.org/) and deployed to [GitHub Pages](https://hardlydifficult.github.io/typescript/) on every push to main. An [llms.txt](https://hardlydifficult.github.io/typescript/llms.txt) file is also generated for AI agent consumption.

```bash
npm run docs            # Generate browsable API docs in docs/
npm run docs:agent      # Generate llms.txt and llms-full.txt in docs/
```

## GitHub Actions Setup

Add an `NPM_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with an [npm automation token](https://www.npmjs.com/settings/~/tokens).

Add a `PAT_TOKEN` [repository secret](https://github.com/HardlyDifficult/typescript/settings/secrets/actions) with a [GitHub PAT](https://github.com/settings/tokens) that has `repo` scope. This is used by the CI auto-fix workflow to push commits that trigger re-runs.

Enable [GitHub Pages](https://github.com/HardlyDifficult/typescript/settings/pages) with source set to **GitHub Actions** for automatic docs deployment.

## Development

```bash
npm install
npm run build
npm run test
```
