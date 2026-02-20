# @hardlydifficult/ci-scripts

CLI tools for CI automation: dependency pinning checks, monorepo publishing, auto-committing fixes, and syncing skills from GitHub.

## Installation

```bash
npm install -D @hardlydifficult/ci-scripts
```

## Quick Start

Run the auto-commit, dependency check, and publish commands directly from CI:

```bash
# Auto-commit and push lint/format fixes
npx auto-commit-fixes

# Ensure all dependencies use pinned versions
npx check-pinned-deps

# Publish monorepo packages with auto-versioning and git tagging
npx monorepo-publish
```

## Commands

### `auto-commit-fixes`

Auto-commits and pushes lint/format fixes to trigger CI re-runs.

#### Usage

Requires the `BRANCH` environment variable (e.g., from `github.head_ref` or `github.ref_name`). Optionally accepts `GH_PAT` for workflow-triggering pushes.

```bash
# Set branch dynamically in GitHub Actions
env:
  BRANCH: ${{ github.head_ref || github.ref_name }}
  GH_PAT: ${{ secrets.GH_PAT }}

# Run auto-commit script
run: npx auto-commit-fixes
```

#### Behavior

- Exits with code 0 if no changes are detected.
- Exits with code 1 after successfully committing and pushing (to trigger CI re-runs).
- Uses `git pull --rebase` with retry logic to handle concurrent pushes.
- Commits with `style: auto-fix linting issues` message.

#### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BRANCH` | Yes | Branch to push to |
| `GH_PAT` | No | GitHub PAT for workflow-triggering push (optional, but recommended) |

### `check-pinned-deps`

Validates that all dependencies in all `package.json` files use exact versions (no `^` or `~` prefixes). Exits with a non-zero code if any unpinned dependencies are found.

#### Usage

Run the command at the monorepo root:

```bash
npx check-pinned-deps
```

#### Behavior

- Recursively scans all `package.json` files in the current directory (excluding `node_modules`, `dist`, `.tmp`).
- Fails if any dependency (dependencies, devDependencies, peerDependencies, optionalDependencies) uses an unpinned version.
- Outputs all violations with file location, field, package name, and version.

#### Example Output

```
Found unpinned dependencies:

  packages/my-package/package.json
    dependencies.lodash: "^4.17.21"

All dependencies must use exact versions (no ^ or ~ prefixes).
```

### `monorepo-publish`

Smart monorepo publisher. Auto-increments patch versions, publishes packages in dependency order, and transforms `file:` references to real versions before publishing.

#### Usage

```bash
npx monorepo-publish [--packages-dir <dir>]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--packages-dir <dir>` | Directory containing packages | `"packages"` |

#### Features

- **Dependency-aware publishing**: Packages are sorted topologically so dependencies are published before dependents.
- **Auto-versioning**: Increments patch version based on latest npm version for the current major.minor.
- **Inter-package dependency resolution**: Updates `file:` references and version numbers in dependent packages before publishing.
- **Git tagging**: Creates and pushes tags in format `<scoped-name-with-slashes-replaced>-v<version>`.

#### Behavior

1. Finds all non-private packages in the specified directory.
2. Sorts packages by dependency order (topological sort).
3. For each package:
   - Checks for changes since the last tag.
   - Updates internal dependencies (transforms `file:` references to versions).
   - Determines new patch version from npm.
   - Updates `package.json` version.
   - Runs `npm publish --access public`.
   - Creates and pushes git tag.
4. Tracks published versions across the run for dependent package updates.

#### Example

```bash
npx monorepo-publish --packages-dir libs
```

#### Output Example

```
Found 3 package(s) (in publish order):
  1. @myorg/core
  2. @myorg/utils

--- Processing @myorg/core ---
No previous tag found. Publishing initial version.
New version: 1.0.0
Publishing to npm...
Successfully published @myorg/core@1.0.0
Created and pushed tag: myorg-core-v1.0.0

--- Processing @myorg/utils ---
Changes detected since myorg-utils-v0.2.1.
Transforming @myorg/core: file:../core → 1.0.0
New version: 0.3.0
Successfully published @myorg/utils@0.3.0
Created and pushed tag: myorg-utils-v0.3.0

Done!
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