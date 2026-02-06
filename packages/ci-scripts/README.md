# @hardlydifficult/ci-scripts

Reusable CI scripts exposed as CLI commands.

## Installation

```bash
npm install -D @hardlydifficult/ci-scripts
```

## Commands

### `check-pinned-deps`

Validates that all dependencies in all `package.json` files use exact versions (no `^` or `~` prefixes). Exits with a non-zero code if any unpinned dependencies are found.

```bash
npx check-pinned-deps
```

### `monorepo-publish`

Smart monorepo publisher. Auto-increments patch versions, publishes packages in dependency order, and transforms `file:` references to real versions before publishing.

```bash
npx monorepo-publish
npx monorepo-publish --packages-dir libs
```

The `--packages-dir` option specifies the directory containing packages. Defaults to `packages`.

### `auto-commit-fixes`

Checks for uncommitted changes, commits them, and pushes with exponential backoff retry. Exits with code 1 after a successful commit to trigger a CI re-run so branch protection sees a clean pass. Does nothing if the working tree is clean.

Requires the `BRANCH` environment variable.

```bash
BRANCH=my-feature npx auto-commit-fixes
```

### `sync-skills`

Pulls `.claude/` skills from GitHub repos listed in `packages/shared-config/skill-repos.json` using the GitHub REST API. Run from the monorepo root.

```bash
npx sync-skills
```

Set the `GITHUB_TOKEN` environment variable for private repos.

### `log-local-skills`

Reports `.claude/` files that exist locally but are not in the shared-config package. Informational only, never fails.

```bash
npx log-local-skills
```

## CI Workflow Integration

Typical GitHub Actions usage for auto-fix workflows:

```yaml
- name: Auto-fix lint and format
  run: npm run fix

- name: Log local .claude skills
  run: npx log-local-skills

- name: Commit and push fixes
  env:
    BRANCH: ${{ github.head_ref || github.ref_name }}
  run: npx auto-commit-fixes
```
