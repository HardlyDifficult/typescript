# @hardlydifficult/shared-config

A shared configuration package that auto-syncs repository root files (`.gitignore` and `.github/dependabot.yml`) after installation via a `postinstall` script.

## Installation

```bash
npm install @hardlydifficult/shared-config
```

## Quick Start

Add `@hardlydifficult/shared-config` as a dev dependency to your project. After running `npm install`, it automatically copies the following shared config files into your repository root:

- `.gitignore`
- `.github/dependabot.yml`

No additional setup or code is required.

## Postinstall Script

Automatically runs after `npm install` and copies shared config files from the package’s `files/` directory to your repository root.

### Behavior

- Uses `INIT_CWD` environment variable (if available) to determine the project root.
- Falls back to walking up the directory tree from `__dirname` to find `node_modules/`.
- Silently skips copying if the root or files directory cannot be determined.

```typescript
// Postinstall runs automatically on install — no manual invocation needed
// Copies these files:
// - .gitignore
// - .github/dependabot.yml
```

### File Copying

- `files/.gitignore` → `.gitignore`
- `files/.github/dependabot.yml` → `.github/dependabot.yml`

Directories are created as needed; existing files are overwritten.

## Shared Config Files

### `.gitignore`

Excludes common build and environment files:

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

- **npm dependencies** (versioning strategy: `increase`)
- **GitHub Actions**
- **git submodules**

All updates are grouped together.

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

## Appendix

### Platform/Environment Notes

| Behavior | Notes |
|----------|-------|
| `INIT_CWD` availability | Set by npm; used to find repo root reliably |
| Fallback logic | Walks up directory tree until `node_modules/` is detected |
| Silent failure | If root or `files/` directory is missing, no errors are thrown |

### Files Copied

| Source (in package) | Destination (in repo root) |
|---------------------|----------------------------|
| `files/.gitignore` | `.gitignore` |
| `files/.github/dependabot.yml` | `.github/dependabot.yml` |