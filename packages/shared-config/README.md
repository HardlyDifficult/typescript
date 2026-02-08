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
| `.claude/` | Merge | Shared files overwrite, local additions preserved |

### Included Skills

The package includes **30 Claude skills** (8 custom + 22 external):

#### Custom Skills (8)

**Development Workflows:**
- `git-workflows` - Git and GitHub operations
- `creating-task-files` - Structured task documentation
- `coordinating-subagents` - Parallel agent coordination
- `capturing-learnings` - Session learning documentation

**Code Quality:**
- `typescript-strict` - Strict TypeScript practices
- `processing-bot-reviews` - Bot review processing

**Testing & Debugging:**
- `browser-automation` - Headless browser testing
- `ui-testing` - Visual UI testing and screenshots

#### External Skills (22)

Skills automatically synced from trusted sources:

- **Anthropics** (16 skills) - PDF, XLSX, PPTX, doc-coauthoring, etc.
- **Vercel Labs** (5 skills) - React, Next.js, design patterns
- **Supabase** (1 skill) - Postgres best practices

See [files/.claude/skills/README.md](files/.claude/skills/README.md) for custom skill documentation.
See [files/.claude/skills/external/README.md](files/.claude/skills/external/README.md) for external skills.

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

## Managing External Skills

External skills are automatically synced from trusted GitHub repositories during the build process.

### Package Default Skills

The package includes default external skills in `external-skills.txt`:

```
# External skill repositories (owner/repo format)
anthropics/skills
vercel-labs/agent-skills
supabase/agent-skills
```

### Project-Specific External Skills

Add project-specific external skills by creating `external-skills.txt` in your project root:

```
# Your custom skill repos (owner/repo format)
your-org/agent-skills
another-org/claude-skills
```

These will be synced alongside the package's default skills. Duplicates are safely ignored with a warning.

### Updating External Skills

External skills are automatically updated during `npm run build`. To manually update:

```bash
npm run sync-external-skills
```

This fetches the latest versions from each upstream repository.

## External Skills Configuration

`external-skills.txt` lists external GitHub repos (in `owner/repo` format) used as skill sources:

```
# External skill repositories
anthropics/skills
vercel-labs/agent-skills
supabase/agent-skills
```

Skills are automatically synced during `npm run build` or manually with:

```bash
npm run sync-external-skills
```

## Local .claude/ Files

The `.claude/` merge strategy means any files you add locally are preserved across syncs. Only files that exist in the shared config are overwritten.

To see which `.claude/` files are local additions (not from the shared config):

```bash
npx log-local-skills
```
