# TypeScript Monorepo

Focused, opinionated, easy-to-use npm packages.

## Packages

| Package | Description |
|---------|-------------|
| [@hardlydifficult/chat](./packages/chat) | Unified chat API for Discord and Slack |

## GitHub Actions Setup

To enable automated publishing to npm, you need to configure an NPM token as a repository secret:

1. Generate an npm access token at [npmjs.com](https://www.npmjs.com/settings/~/tokens)
   - Select "Automation" token type for CI/CD usage
2. Add the token to your [GitHub repository secrets](https://github.com/HardlyDifficult/typescript/settings/secrets/actions):
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: Your npm access token

## Development

```bash
npm install
npm run build
npm run test
```
