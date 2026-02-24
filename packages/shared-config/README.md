# @hardlydifficult/shared-config

A shared configuration package that provides consistent TypeScript settings and automated file synchronization for the monorepo.

## Installation

```bash
npm install @hardlydifficult/shared-config
```

## Quick Start

Add this package as a dev dependency to your project. After running `npm install`, it automatically copies shared configuration files (`.gitignore` and `.github/dependabot.yml`) into your repository root.

```typescript
import { packageName } from "@hardlydifficult/shared-config";

console.log(packageName); // "@hardlydifficult/shared-config"
```

## API Reference

### `packageName`

A string constant identifying the package name.

| Value | Type | Description |
|-------|------|-------------|
| `"@hardlydifficult/shared-config"` | `string` | The canonical package name for import and identification |

### Postinstall Behavior

This package runs a postinstall script that:

- Copies `.gitignore` from `files/` to the repository root (overwrites existing)
- Copies `.github/dependabot.yml` from `files/.github/` to `.github/dependabot.yml` (overwrites existing)
- Gracefully skips execution if the repository root cannot be determined

#### Platform/Environment Notes

| Behavior | Notes |
|----------|-------|
| `INIT_CWD` availability | Set by npm; used to find repo root reliably |
| Fallback logic | Walks up directory tree until `node_modules/` is detected |
| Silent failure | If root or `files/` directory is missing, no errors are thrown |

## Configuration Files

### `.gitignore`

Contains standard ignores for TypeScript projects:
```gitignore
node_modules/
dist/
coverage/
.turbo/
*.log
package-lock.json
.env
.env.*
!.env.example
```

### `.github/dependabot.yml`

Configures weekly automated updates for:
- **npm packages** — with `versioning-strategy: increase`
- **GitHub Actions** — all actions updated weekly
- **Git submodules** — all updated weekly

All updates are grouped under `all-updates`.

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    versioning-strategy: increase
    groups:
      all-updates:
        patterns:
          - "*"
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    groups:
      all-updates:
        patterns:
          - "*"
  - package-ecosystem: gitsubmodule
    directory: /
    schedule:
      interval: weekly
    groups:
      all-updates:
        patterns:
          - "*"
```

## TypeScript Configuration

The package includes `tsconfig.json` with strict settings suitable for shared TypeScript code:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

## Scripts

| Script | Description |
|--------|-------------|
| `build` | Compiles TypeScript to `dist/` |
| `clean` | Removes `dist/` directory |
| `lint` | Runs `tsc --noEmit` for type-checking |
| `postinstall` | Runs the config file sync script |

## Setup

No additional setup is required. This package is intended for internal use within the monorepo and automatically syncs configuration on install.

## Appendix

| File | Source Path | Destination Path | Behavior |
|------|-------------|------------------|----------|
| `.gitignore` | `files/.gitignore` | `<repo-root>/.gitignore` | Overwrites if exists |
| `dependabot.yml` | `files/.github/dependabot.yml` | `<repo-root>/.github/dependabot.yml` | Overwrites if exists, creates `.github/` if needed |

**Note:** The package expects the `files/` directory to be present at build time. If not (e.g., during development), the postinstall script exits silently.