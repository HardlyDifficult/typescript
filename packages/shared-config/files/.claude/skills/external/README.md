# External Skills (References)

Lightweight reference skills that point to externally maintained skills.

**Total reference skills:** 28

## How Reference Skills Work

These are lightweight skills that contain only metadata (name/description) to trigger when relevant.
When activated, they instruct the agent to clone the external repository and read the full skill.

This keeps the shared-config package lean while providing access to external skills.

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
```

### Updating

```bash
npm run sync-external-skills
```
