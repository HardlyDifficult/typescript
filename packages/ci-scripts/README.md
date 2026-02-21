# @hardlydifficult/ci-scripts

CLI tools for CI automation: dependency pinning validation, monorepo publishing with inter-package dependency resolution, and auto-committing linting fixes.

## Installation

```bash
npm install @hardlydifficult/ci-scripts
```

## Quick Start

```typescript
// Check for unpinned dependencies across the monorepo
// npx check-pinned-deps

// Auto-commit lint/format fixes
// npx auto-commit-fixes

// Publish monorepo packages with versioning and git tags
// npx monorepo-publish
```

## Dependency Checking

Validates that all dependencies in `package.json` files use pinned versions (no `^` or `~` prefixes).

### Usage

```bash
npx check-pinned-deps
```

### Environment

Runs in the current working directory and recursively checks all `package.json` files except those in `node_modules`, `dist`, and `.tmp` directories.

### Example

```bash
$ npx check-pinned-deps

Checked 5 package.json file(s) - all dependencies are pinned.
```

If unpinned dependencies are found:

```bash
$ npx check-pinned-deps
Found unpinned dependencies:

  packages/my-lib/package.json
    dependencies.lodash: "^4.17.21"

All dependencies must use exact versions (no ^ or ~ prefixes).
Fix by removing the ^ or ~ prefix from each version.
```

## Auto-Commit Fixes

Auto-commits and pushes lint/format fixes (e.g., from ESLint or Prettier) to trigger CI re-runs.

### Usage

```bash
npx auto-commit-fixes
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BRANCH` | The branch to push to (e.g., `${{ github.head_ref || github.ref_name }}` in GitHub Actions) | Yes |
| `GH_PAT` | GitHub personal access token (PAT) to trigger workflow on push | No |

### Example

```typescript
// In a GitHub Actions workflow:
// - name: Auto-fix linting issues
//   run: npx auto-commit-fixes
//   env:
//     BRANCH: ${{ github.head_ref || github.ref_name }}
//     GH_PAT: ${{ secrets.GH_PAT }}
```

If no changes are detected:

```bash
$ npx auto-commit-fixes
No changes detected. Nothing to commit.
```

If changes are detected and pushed:

```bash
$ npx auto-commit-fixes
Auto-fix commit pushed successfully.
This build will fail so the next CI run validates the fixes.
```

## Monorepo Publishing

Publishes packages that have changed since the last publish, with automatic versioning and git tagging.

### Features

- Detects inter-package dependencies and publishes them first (topological sort)
- Auto-updates dependency versions before publishing dependent packages
- Transforms `file:` references to real versions at publish time
- Auto-increments patch versions based on the latest version published to npm
- Creates and pushes git tags in format `<safe-package-name>-v<version>`

### Usage

```bash
npx monorepo-publish [--packages-dir <dir>]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--packages-dir` | Directory containing packages | `packages` |

### Example

```bash
$ npx monorepo-publish

Found 3 package(s) (in publish order):
  1. @acme/utils
  2. @acme/core
  3. @acme/react

--- Processing @acme/utils ---
No previous tag found. Publishing initial version.
New version: 1.0.0
Publishing to npm...
Successfully published @acme/utils@1.0.0
Created and pushed tag: acme-utils-v1.0.0

--- Processing @acme/core ---
Changes detected since @acme/utils-v1.0.0.
Updating @acme/utils: ^1.0.0 → 1.0.0
New version: 1.0.1
Successfully published @acme/core@1.0.1
Created and pushed tag: acme-core-v1.0.1

Done!
```

### Inter-Package Dependency Resolution

When publishing multiple packages, the tool:

1. Determines publish order using topological sort based on dependency graph
2. Tracks newly published versions during the run
3. Updates `dependencies` and `devDependencies` that reference internal packages:
   - `file:../package` → exact version string (e.g., `"1.0.0"`)
   - existing version numbers → updated if a newer version was published

Note: `peerDependencies` are excluded from `file:` transformations since they should use version ranges for compatibility.