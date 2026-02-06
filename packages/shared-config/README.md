# @hardlydifficult/shared-config

Shared configuration files synced to consuming repos via `postinstall` hook.

## What Gets Synced

- `.gitignore` — overwritten (shared config is authoritative)
- `.github/dependabot.yml` — overwritten
- `.claude/` — merged (shared files overwrite, local additions preserved)

## Setup for a New Repo

### 1. Install packages

```bash
npm install -D @hardlydifficult/ts-config @hardlydifficult/shared-config @hardlydifficult/ci-scripts
```

### 2. ESLint — create `eslint.config.js`

```js
import createConfig from "@hardlydifficult/ts-config/eslint";
export default createConfig(import.meta.dirname);
```

For monorepos with config in a subdirectory:

```js
import createConfig from "@hardlydifficult/ts-config/eslint";
export default createConfig(import.meta.dirname + "/..");
```

### 3. Prettier — add to `package.json`

```json
"prettier": "@hardlydifficult/ts-config/prettier"
```

### 4. TypeScript — create or update `tsconfig.json`

```json
{ "extends": "@hardlydifficult/ts-config/tsconfig.base.json" }
```

### 5. npm scripts — add to `package.json`

```json
"fix": "eslint --fix . && prettier --write .",
"lint": "eslint .",
"format:check": "prettier --check ."
```

### 6. CI workflow

Copy the CI workflow from this repo's `.github/workflows/ci.yml` or reference the template.

Set up a `PAT_TOKEN` secret in your repo settings (GitHub PAT with `repo` scope) so auto-fix commits trigger CI re-runs.

### 7. Run `npm install`

The postinstall hook syncs `.gitignore`, `dependabot.yml`, and `.claude/` skills automatically.

## Updating Shared Config

Just run `npm install` — the postinstall hook always syncs the latest bundled files.

To explicitly update: `npm install @hardlydifficult/shared-config@latest`

## Skill Repos

Skills are pulled from external GitHub repos listed in `skill-repos.json` (not published to npm).
Run `npx sync-skills` from the monorepo root to pull latest skills before publishing.
