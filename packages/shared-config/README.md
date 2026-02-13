# @hardlydifficult/shared-config

Shared configuration files synced to consuming repos via a `postinstall` hook.

## Installation

```bash
npm install -D @hardlydifficult/shared-config
```

## What Gets Synced

| Path | Strategy | Details |
|------|----------|---------|
| `.gitignore` | Overwrite | Shared config is authoritative |
| `.github/dependabot.yml` | Overwrite | Shared config is authoritative |

## How It Works

The package has a `postinstall` hook that runs automatically on `npm install`. It copies the bundled shared files into the consuming repo's root directory using the strategies listed above.

No manual steps required after installation. Every `npm install` re-syncs the files.

## Updating

```bash
# Re-sync with the currently installed version
npm install

# Bump to the latest published version
npm install @hardlydifficult/shared-config@latest
```

Both commands trigger the `postinstall` hook, which re-syncs all shared files.
