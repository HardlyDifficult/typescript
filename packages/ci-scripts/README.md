# @hardlydifficult/ci-scripts

CLI tools for CI automation: dependency pinning, monorepo publishing, auto-committing fixes, and skill syncing.

## Installation

```bash
npm install -D @hardlydifficult/ci-scripts
```

## Quick Start

```bash
# Check for unpinned dependencies across the monorepo
npx check-pinned-deps

# Auto-commit lint/format fixes and push to trigger CI re-run
npx auto-commit-fixes

# Publish monorepo packages with versioning and git tagging
npx monorepo-publish
```

## Commands

### `auto-commit-fixes`

Auto-commits and pushes lint/format fixes to trigger CI re-runs.

#### Usage

Requires the `BRANCH` environment variable (e.g., `github.head_ref` or `github.ref_name`). Optionally accepts `GH_PAT` for workflow-triggering pushes.

```bash
# Set branch dynamically in GitHub Actions
env:
  BRANCH: ${{ github.head_ref || github.ref_name }}
  GH_PAT: ${{ secrets.GH_PAT }}

# Run auto-commit script
run: npx auto-commit-fixes
```

#### Behavior

- Exits with code `0` if no changes are detected.
- Exits with code `1` after successfully committing and pushing (to trigger CI re-runs).
- Uses `git pull --rebase` with retry logic to handle concurrent pushes.
- Commits with `style: auto-fix linting issues` message.

#### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BRANCH` | Yes | Branch to push to |
| `GH_PAT` | No | GitHub PAT for workflow-triggering push (recommended) |

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

  path/to/package.json
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

| Option | Default | Description |
|--------|---------|-------------|
| `--packages-dir` | `packages` | Directory containing monorepo packages |

#### Features

- Detects changed packages since last publish
- Resolves dependency order using topological sort
- Updates internal `file:` references to real versions
- Auto-increments patch versions based on npm's latest published version
- Creates and pushes git tags (format: `<normalized-name>-v<version>`)

#### Versioning Logic

- Uses `major.minor` from `package.json` (controlled by developers)
- Auto-determines patch version from npm's latest for that `major.minor`
- If no versions exist on npm, starts at `.0`

#### Inter-Package Dependency Handling

- Publishes dependencies before dependents (topologically sorted)
- Transforms `file:../pkg` references to real versions during publish
- Excludes `peerDependencies` from `file:` transformations (use ranges for compatibility)

#### Example Output

```
Found 3 package(s) (in publish order):
  1. @myorg/core
  2. @myorg/utils
  3. @myorg/cli

--- Processing @myorg/core ---
No previous tag found. Publishing initial version.
New version: 1.0.0
Publishing to npm...
Successfully published @myorg/core@1.0.0
Created and pushed tag: myorg-core-v1.0.0
```

#### Environment Requirements

- `npm` authentication (e.g., `npm login` or token via environment)
- Git remote configured with push permissions

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