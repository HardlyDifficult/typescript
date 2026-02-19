# @hardlydifficult/ci-scripts

Reusable CI scripts exposed as CLI commands for dependency checking, monorepo publishing, and automated code fixes.

## Installation

```bash
npm install -D @hardlydifficult/ci-scripts
```

## Usage

Get started with common CI automation tasks in a few lines:

```typescript
// Auto-fix linting issues and trigger CI re-run
import { autoCommitFixes } from "@hardlydifficult/ci-scripts";

// Validate pinned dependencies across the monorepo
import { checkPinnedDeps } from "@hardlydifficult/ci-scripts";

// Smart monorepo publishing with dependency ordering
import { monorepoPublish } from "@hardlydifficult/ci-scripts";

// Sync skills from GitHub repositories
import { syncSkills } from "@hardlydifficult/ci-scripts";
```

## Commands

### `check-pinned-deps`

Validates that all dependencies in all `package.json` files use exact versions (no `^` or `~` prefixes). Exits with a non-zero code if any unpinned dependencies are found.

```bash
npx @hardlydifficult/ci-scripts check-pinned-deps
```

### `monorepo-publish`

Smart monorepo publisher. Auto-increments patch versions, publishes packages in dependency order, and transforms `file:` references to real versions before publishing.

```bash
npx @hardlydifficult/ci-scripts monorepo-publish
npx @hardlydifficult/ci-scripts monorepo-publish --packages-dir libs
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--packages-dir` | Directory containing packages | `packages` |

### `auto-commit-fixes`

Checks for uncommitted changes, commits them, and pushes with exponential backoff retry. Exits with code 1 after a successful commit to trigger a CI re-run so branch protection sees a clean pass. Does nothing if the working tree is clean.

```bash
BRANCH=my-feature npx @hardlydifficult/ci-scripts auto-commit-fixes
```

**Environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `BRANCH` | Yes | The branch to push to (e.g., `${{ github.head_ref || github.ref_name }}`) |
| `GH_PAT` | No | GitHub PAT used for push to trigger workflows |

### `sync-skills`

Pulls `.claude/` skills from GitHub repos listed in `packages/shared-config/skill-repos.json` using the GitHub REST API. Run from the monorepo root.

```bash
npx @hardlydifficult/ci-scripts sync-skills
```

Set the `GITHUB_TOKEN` environment variable for private repos.

### `log-local-skills`

Reports `.claude/` files that exist locally but are not in the shared-config package. Informational only, never fails.

```bash
npx @hardlydifficult/ci-scripts log-local-skills
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