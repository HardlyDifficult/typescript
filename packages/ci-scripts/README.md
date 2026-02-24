# @hardlydifficult/ci-scripts

CLI tools for CI automation: dependency pinning validation, monorepo publishing with inter-package resolution, and auto-committing linting fixes.

## Installation

```bash
npm install @hardlydifficult/ci-scripts
```

## Quick Start

```typescript
// Use the exported package name identifier
import { packageName } from "@hardlydifficult/ci-scripts";

console.log(packageName); // "@hardlydifficult/ci-scripts"
```

## Auto-committing Linting Fixes

Auto-commits and pushes lint/format auto-fixes, exiting 0 if no changes or 1 after a successful commit to trigger a CI re-run.

### Usage

```bash
npx auto-commit-fixes
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BRANCH` | Yes | Branch to push to (e.g., `${{ github.head_ref || github.ref_name }}`) |
| `GH_PAT` | No | GitHub PAT for push (triggers CI); default `GITHUB_TOKEN` does not |

### Example

```typescript
// .github/workflows/lint.yml
- name: Auto-fix and commit
  run: npx auto-commit-fixes
  env:
    BRANCH: ${{ github.head_ref || github.ref_name }}
    GH_PAT: ${{ secrets.GH_PAT }}
```

## Package Metadata Validation

Validates monorepo package metadata for consistency with the baseline configuration.

### Checks

- `engines.node` equals `>=20.19.0`
- Required fields: `name`, `version`, `files`, `scripts`, `engines`
- Required scripts: `build`, `clean`
- `files` array must not be empty

### Usage

```bash
npx check-package-metadata
```

### Example Output (Success)

```
Validated 3 package.json file(s): metadata and Node baseline are consistent.
```

### Example Output (Failure)

```
Package metadata validation failed:

  packages/example/package.json
    - missing required script: scripts.test
```

## Dependency Pinning Validation

Ensures all dependencies in package.json files use exact versions (no `^` or `~` prefixes).

### Usage

```bash
npx check-pinned-deps
```

### Environment

Runs in the current working directory and recursively checks all `package.json` files except those in `node_modules`, `dist`, and `.tmp` directories.

### Example

```bash
# Fails if package.json contains:
"dependencies": {
  "lodash": "^4.17.21"
}

# Instead of:
"dependencies": {
  "lodash": "4.17.21"
}
```

### Example Output (Success)

```bash
$ npx check-pinned-deps

Checked 5 package.json file(s) - all dependencies are pinned.
```

### Example Output (Failure)

```bash
$ npx check-pinned-deps
Found unpinned dependencies:

  packages/my-lib/package.json
    dependencies.lodash: "^4.17.21"

All dependencies must use exact versions (no ^ or ~ prefixes).
Fix by removing the ^ or ~ prefix from each version.
```

## Monorepo Publishing

Publishes changed packages with auto-incremented patch versions and resolves inter-package dependencies.

### Features

- Topological sort ensures dependencies are published first
- Auto-updates `file:` references to versioned dependencies
- Auto-determines next patch version from npm history
- Tags and pushes git tags after successful publish

### Usage

```bash
npx monorepo-publish [--packages-dir <dir>]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--packages-dir` | `packages` | Directory containing monorepo packages |

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

### Dependency Resolution

If package `A` depends on `B` (both in the monorepo), and only `B` changed:

- `B` is published first with version `1.1.3`
- `A`’s `file:../B` reference is transformed to `"1.1.3"`
- `A` is published with `1.1.3` in its `dependencies`

**Note:** `peerDependencies` are excluded from `file:` transformations since they should use version ranges for compatibility.