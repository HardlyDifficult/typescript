# @hardlydifficult/ci-scripts

Opinionated CI helpers for this monorepo.

The package is library-first now. Instead of importing a placeholder constant or wiring raw shell scripts together, client code can call the intent directly:

```ts
import { ci } from "@hardlydifficult/ci-scripts";

await ci.fix();
ci.requirePinnedDependencies();
ci.requirePackageMetadata();
ci.publish();
```

## Installation

```bash
npm install @hardlydifficult/ci-scripts
```

## Defaults

- Commands auto-detect the workspace root, so they work from any package directory.
- `ci.fix()` auto-detects the branch from `BRANCH`, `GITHUB_HEAD_REF`, or `GITHUB_REF_NAME`.
- Package metadata validation reads the Node baseline from the workspace root `package.json`.
- Publishing still defaults to the `packages/` directory.

## API

```ts
import {
  autoCommitFixes,
  assertPackageMetadata,
  assertPinnedDependencies,
  checkPackageMetadata,
  checkPinnedDependencies,
  ci,
  publishPackages,
} from "@hardlydifficult/ci-scripts";
```

### `ci.fix()`

Auto-commits and pushes generated fixes. Returns a result object with `committed`, `pushed`, and `rerunRequired`.

```ts
const result = await ci.fix();

if (result.rerunRequired) {
  process.exitCode = 1;
}
```

### `ci.requirePinnedDependencies()`

Throws if any `package.json` under the workspace uses `^` or `~`.

```ts
ci.requirePinnedDependencies();
```

### `ci.requirePackageMetadata()`

Throws if a package under `packages/` is missing required metadata or has an `engines.node` mismatch with the workspace baseline.

```ts
ci.requirePackageMetadata();
```

### `ci.publish()`

Publishes changed packages in dependency order and returns a summary of published and skipped packages.

```ts
const result = ci.publish();
console.log(result.published.map((pkg) => `${pkg.name}@${pkg.version}`));
```

## CLI

The CLI entry points still exist:

```bash
npx auto-commit-fixes
npx check-pinned-deps
npx check-package-metadata
npx monorepo-publish
```

### Auto-commit fixes

`auto-commit-fixes` now infers the branch automatically. Set `BRANCH` only when you need to override detection.

| Variable            | Required | Description                                                    |
| ------------------- | -------- | -------------------------------------------------------------- |
| `BRANCH`            | No       | Explicit branch override                                       |
| `GITHUB_HEAD_REF`   | No       | Auto-used in PR workflows                                      |
| `GITHUB_REF_NAME`   | No       | Auto-used in push workflows                                    |
| `GH_PAT`            | No       | GitHub PAT for pushes that should trigger another workflow run |
| `GITHUB_REPOSITORY` | No       | `owner/repo`, used together with `GH_PAT`                      |

Example:

```yaml
- name: Auto-fix and commit
  run: npx auto-commit-fixes
  env:
    GH_PAT: ${{ secrets.GH_PAT }}
```

### Package metadata validation

Checks:

- `engines.node` matches the workspace root baseline
- required fields: `name`, `version`, `files`, `scripts`, `engines`
- required scripts: `build`, `clean`
- `files` is not empty

### Dependency pinning validation

Recursively checks the workspace root for `package.json` files while skipping `node_modules`, `dist`, and `.tmp`.

### Monorepo publishing

Usage:

```bash
npx monorepo-publish [--packages-dir <dir>]
```

Features:

- publishes in dependency order
- transforms internal `file:` references into published versions
- bumps patch versions based on npm history for the current `major.minor`
- tags each published package in git
