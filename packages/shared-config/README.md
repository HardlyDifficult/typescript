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

#### External Skills (28 lightweight references)

**Lightweight reference skills** that point to externally maintained skills. When activated, the agent fetches the full skill from the source repository.

- **Anthropics** (16 skills) - PDF, XLSX, PPTX, doc-coauthoring, etc.
- **Vercel Labs** (10 skills) - React, Next.js, design patterns
- **Supabase** (2 skills) - Postgres best practices

**Benefits of reference skills:**
- Minimal repo size (500 bytes vs 100KB+ per skill)
- Always up-to-date (fetches latest from source)
- Full skill discoverability (name/description in metadata)

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

External skills use a **lightweight reference system** - the package includes only metadata (name/description) to trigger skill discovery. When activated, the agent fetches the full skill content from the source repository.

This keeps the repo lean (500 bytes vs 100KB+ per skill) while maintaining full discoverability.

### How Reference Skills Work

1. **Discovery:** Claude sees the skill name and description in the reference
2. **Activation:** When relevant, Claude reads the reference which contains fetch instructions
3. **Fetch:** The agent uses `curl` to fetch the full skill from the source repository
4. **Execute:** The agent follows the full skill instructions

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

Reference skills are automatically regenerated during `npm run build`. To manually update:

```bash
npm run sync-external-skills
```

This fetches the latest metadata from each upstream repository and regenerates the lightweight references.

## Local .claude/ Files

The `.claude/` merge strategy means any files you add locally are preserved across syncs. Only files that exist in the shared config are overwritten.

To see which `.claude/` files are local additions (not from the shared config):

```bash
npx log-local-skills
```
