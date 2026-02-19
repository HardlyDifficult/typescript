# @hardlydifficult/shared-config

Automatically syncs shared configuration files to consuming repositories via a `postinstall` hook.

## Installation

```bash
npm install -D @hardlydifficult/shared-config
```

## Quick Start

After installation, the package automatically syncs shared configuration files to your repository root. No additional setup required—the `postinstall` hook runs automatically on `npm install`.

```bash
# Files are synced automatically
npm install
```

## How It Works

The package includes a `postinstall` script that runs automatically after installation. It:

1. Detects your repository root using the `INIT_CWD` environment variable (set by npm) or by walking up the directory tree
2. Locates the bundled shared configuration files
3. Copies them to your repository root, overwriting any existing versions

The script runs silently if it cannot determine the repository root or find the configuration files, ensuring it never breaks the installation process.

## Synced Files

| File | Strategy | Purpose |
|------|----------|---------|
| `.gitignore` | Overwrite | Shared ignore rules for Node.js projects (node_modules, dist, coverage, .turbo, logs, .env files) |
| `.github/dependabot.yml` | Overwrite | Automated dependency updates for npm packages, GitHub Actions, and git submodules on a weekly schedule |

## Re-syncing Configuration

To re-sync files with the currently installed version:

```bash
npm install
```

To update to the latest published version and re-sync:

```bash
npm install @hardlydifficult/shared-config@latest
```

Both commands trigger the `postinstall` hook automatically.

## Development

Build the package:

```bash
npm run build
```

Lint TypeScript without emitting:

```bash
npm run lint
```

Clean build artifacts:

```bash
npm run clean
```