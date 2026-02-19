# @hardlydifficult/shared-config

Shared configuration files synced to consuming repos via a `postinstall` hook.

## Installation

```bash
npm install -D @hardlydifficult/shared-config
```

## Usage

Install the package as a dev dependency, then run `npm install` to automatically sync configuration files:

```bash
npm install -D @hardlydifficult/shared-config
npm install
```

After installation, your repo will contain:
- `.gitignore` — Shared ignore rules
- `.github/dependabot.yml` — Automated dependency updates

No manual steps are required after installation.

## Synced Files

| Path | Strategy | Description |
|------|----------|-------------|
| `.gitignore` | Overwrite | Shared config overrides local file |
| `.github/dependabot.yml` | Overwrite | Weekly updates for npm, GitHub Actions, and git submodules |

## Configuration Details

### .gitignore

Includes common patterns for TypeScript projects:

```text
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

### .github/dependabot.yml

Configures Dependabot to update dependencies weekly with an "increase" versioning strategy:

- npm packages (all dependencies grouped)
- GitHub Actions (all actions grouped)
- Git submodules (all grouped)

Updates are applied to the root directory (`/`) for each ecosystem.

## Updating

To sync with the currently installed version:

```bash
npm install
```

To update to the latest published version:

```bash
npm install @hardlydifficult/shared-config@latest
```

Both commands trigger the `postinstall` hook, which re-syncs all shared files.