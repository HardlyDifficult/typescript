# @hardlydifficult/ci-scripts

CLI tools for CI automation: dependency pinning, monorepo publishing, auto-fix commits, and git tagging.

## Installation

```bash
npm install @hardlydifficult/ci-scripts
```

## Quick Start

```typescript
// Auto-fix linting issues, commit, and push to trigger CI
exec('npx auto-commit-fixes');

// Check all dependencies are pinned (no ^ or ~ prefixes)
exec('npx check-pinned-deps');

// Publish monorepo packages with auto-versioning and tags
exec('npx monorepo-publish --packages-dir packages');
```

## Auto-fixes

Auto-commits and pushes linting/formatting fixes to trigger CI re-runs using a personal access token (PAT) to ensure the commit triggers a new workflow.

### Environment variables

- `BRANCH` — Required. The branch to push to (e.g., `${{ github.head_ref || github.ref_name }}`)
- `GH_PAT` — Optional. GitHub PAT used for push; default GITHUB_TOKEN does not trigger workflows

### Example

```bash
# In a GitHub Actions workflow
- name: Auto-fix and push
  env:
    BRANCH: ${{ github.head_ref || github.ref_name }}
    GH_PAT: ${{ secrets.GH_PAT }}
  run: npx auto-commit-fixes
```

If no changes are detected, the script exits 0 with a log message. Otherwise, it commits, pushes, and exits 1 to trigger a fresh CI run.

## Dependency Checking

Validates that all `package.json` files in the repository use pinned versions (exact versions without `^` or `~` prefixes).

### Example

```bash
npx check-pinned-deps
```

Example output on failure:

```
Found unpinned dependencies:

  ./packages/foo/package.json
    dependencies.lodash: "^4.17.21"

All dependencies must use exact versions (no ^ or ~ prefixes).
Fix by removing the ^ or ~ prefix from each version.
```

### Supported dependency types

- `dependencies`
- `devDependencies`
- `peerDependencies`
- `optionalDependencies`

## Monorepo Publishing

Publishes changed packages in a monorepo with auto-versioning and inter-package dependency resolution.

### Features

- Topological sort ensures dependencies are published before dependents
- Auto-increments patch versions based on npm's latest published version for that major.minor
- Transforms `file:` references to real versions for published packages
- Creates and pushes git tags in `pkgName-vX.Y.Z` format

### Usage

```bash
npx monorepo-publish [--packages-dir <dir>]
```

### Options

| Option         | Default   | Description                         |
|----------------|-----------|-------------------------------------|
| `--packages-dir` | `"packages"` | Directory containing packages |

### Example

```bash
npx monorepo-publish --packages-dir packages
```

Example output:

```
Found 3 package(s) (in publish order):
  1. @myorg/utils
  2. @myorg/components
  3. @myorg/app

--- Processing @myorg/utils ---
No previous tag found. Publishing initial version.
No existing versions for 1.0.x on npm.
New version: 1.0.0
Publishing to npm...
Successfully published @myorg/utils@1.0.0
Created and pushed tag: myorg-utils-v1.0.0

--- Processing @myorg/components ---
Changes detected since myorg-components-v0.1.0.
  Transforming @myorg/utils: file:../utils → 1.0.0
New version: 0.2.0
...
```

### Dependency handling

- `dependencies`, `devDependencies` — `file:` references are transformed to exact versions
- `peerDependencies` — `file:` references are skipped with a warning (use ranges for compatibility)

### Versioning strategy

1. Extract major.minor from `package.json` (controlled by developers)
2. Query npm for the latest patch version of that major.minor
3. Increment patch: `major.minor.(latestPatch + 1)`
4. If no versions exist on npm, start at `.0`

### Git tagging

Tags are created as `<normalized-name>-v<version>` where `@` and `/` in package names are replaced (e.g., `@myorg/foo@1.2.3` → `myorg-foo-v1.2.3`).