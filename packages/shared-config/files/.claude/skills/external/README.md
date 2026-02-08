# External Skills

Skills from external repositories, automatically synced.

## Sources

### anthropics

- **[skills](https://github.com/anthropics/skills)**

### vercel-labs

- **[agent-skills](https://github.com/vercel-labs/agent-skills)**

### supabase

- **[agent-skills](https://github.com/supabase/agent-skills)**

## Managing External Skills

### Package Default Skills

Default skills are listed in the package's `external-skills.txt`.

### Adding Project-Specific Skills

Create `external-skills.txt` in your project root:

```
# Your custom skill repos
your-org/agent-skills
another-org/claude-skills
```

These will be synced alongside the package's default skills.

### Updating

To sync with the latest versions:

```bash
npm run sync-external-skills
```
