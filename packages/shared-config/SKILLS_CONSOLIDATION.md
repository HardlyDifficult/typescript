# Skills Consolidation Summary

## Overview

Consolidated 18 skills across garden and fairmint-workspace repos. Moved 8 generic skills to `@hardlydifficult/shared-config` package, leaving 10 repo-specific skills in place.

## Skills Moved to Shared-Config (8)

All skills refactored according to [Anthropic's best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):

### Development Workflows
1. **`git-workflows`** (from fairmint: `git`)
   - Git and GitHub operations: pull, commit, PR, reset
   - Removed workspace-specific references
   - Added clickable PR link formatting

2. **`creating-task-files`** (from fairmint: `task`)
   - Structured task documentation for AI-assisted work
   - Removed Linear-specific team IDs
   - Generalized issue tracking integration

3. **`coordinating-subagents`** (from fairmint: `subagents`)
   - Parallel agent coordination and context management
   - Already generic, made more concise
   - Removed Cursor-specific references

4. **`capturing-learnings`** (from garden: `gg`)
   - Document session learnings and patterns
   - Already generic, simplified structure

### Code Quality
5. **`typescript-strict`** (from fairmint: `typescript`)
   - Strict TypeScript typing and best practices
   - Already generic, no changes needed

6. **`processing-bot-reviews`** (from fairmint: `bot-review`)
   - Systematic processing of AI bot review findings
   - Already generic, no changes needed

### Testing & Debugging
7. **`browser-automation`** (from garden: `screenshots`)
   - Headless browser testing with agent-browser
   - Removed garden-specific screenshot branch references
   - Made more generic with owner/repo placeholders

8. **`ui-testing`** (from fairmint: `ui-testing`)
   - Visual UI testing, screenshots, bug documentation
   - Removed Linear GraphQL API specifics
   - Made screenshot upload generic

## Skills Remaining in Repos (10)

### Garden (.claude/skills/)
- `supabase-garden` - Garden-specific Supabase + NextAuth config
- `qa-testing` - Garden-specific Next.js testing patterns
- `team` - Garden-specific parallel agent coordination
- `trello` - Garden-specific Trello board IDs
- `plant-research` - Garden-specific plant data research
- `social-media` - Has Garden context (could be generic with minor edits)

### Fairmint Workspace (.cursor/skills/)
- `localnet` - Canton Network LocalNet setup
- `review-linear` - Fairmint Linear + GitHub workflow
- `local-sdk-testing` - Fairmint SDK dependency chain
- `linear-api` - Fairmint team IDs and GraphQL API

## Key Improvements Applied

Based on Anthropic's skill authoring best practices:

1. **Concise content** - Removed verbose explanations, assume Claude is smart
2. **Third-person descriptions** - All descriptions use third person for system prompt injection
3. **Gerund naming** - All skills use verb+ing form (e.g., `capturing-learnings`)
4. **Progressive disclosure** - Kept main SKILL.md under 500 lines
5. **No deep nesting** - All references are one level deep from SKILL.md
6. **Structured output** - Clear report formats where applicable

## Package Updates

- ✅ Created `files/.claude/skills/` directory with 8 skills
- ✅ Added `files/.claude/skills/README.md` documenting all skills
- ✅ Updated main `README.md` with skills section
- ✅ Existing `postinstall.ts` will automatically copy skills to consuming repos

## Next Steps for You

### 1. Review the Skills

Check the refactored skills in `files/.claude/skills/`:
- Are the descriptions clear and discoverable?
- Is anything too generic or missing important context?
- Do the skills follow your preferred style?

### 2. Test the Package Locally

Test that skills install correctly:

```bash
cd typescript/packages/shared-config
npm run build

# Test in another repo
cd ../../../garden  # or any repo
npm install ../typescript/packages/shared-config
ls -la .claude/skills/  # Should show new skills
```

### 3. Publish to NPM

Once you approve:

```bash
cd typescript/packages/shared-config
npm version patch  # or minor/major
npm publish
```

### 4. Clean Up Source Repos

After publishing and consuming repos are updated:

**Garden:**
```bash
cd garden
npm install @hardlydifficult/shared-config@latest
# Remove duplicated skills
rm -rf .claude/skills/gg
rm -rf .claude/skills/screenshots
```

**Fairmint Workspace:**
```bash
cd fairmint/fairmint-workspace
npm install @hardlydifficult/shared-config@latest
# Remove duplicated skills (these were in .cursor, may need manual cleanup)
# Note: .cursor vs .claude directory difference
```

### 5. Update Repo CLAUDE.md Files

Update any references to moved skills in CLAUDE.md files to point to the shared-config versions.

## Sources

All improvements based on:
- [Anthropic Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [The Complete Guide to Building Skills for Claude](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)

## Questions?

- Skills missing important context?
- Repo-specific references that slipped through?
- Better organization or naming?

Let me know and I can refine further!
