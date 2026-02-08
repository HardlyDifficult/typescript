# Shared Claude Skills

Reusable Claude Code skills for common development workflows.

## Available Skills

### Development Workflows

- **`git-workflows`** - Git and GitHub operations (pull, commit, PR, reset)
- **`creating-task-files`** - Structured task documentation for AI-assisted work
- **`coordinating-subagents`** - Parallel agent coordination and context management
- **`capturing-learnings`** - Document session learnings and patterns

### Code Quality

- **`typescript-strict`** - Strict TypeScript typing and best practices
- **`processing-bot-reviews`** - Systematic processing of AI bot review findings

### Testing & Debugging

- **`browser-automation`** - Headless browser testing with agent-browser
- **`ui-testing`** - Visual UI testing, screenshots, and bug documentation

## Usage

Install `@hardlydifficult/shared-config` and the skills will be automatically available in your `.claude/skills/` directory through the package's postinstall script.

```bash
npm install @hardlydifficult/shared-config
```

## Skill Design Principles

These skills follow [Anthropic's skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):

- **Concise** - Assume Claude is smart, only provide what's needed
- **Third-person descriptions** - Injected into system prompts
- **Gerund naming** - Activity-based names (verb + -ing)
- **Progressive disclosure** - Reference files loaded only when needed
- **One level deep** - No deeply nested references
- **Structured output** - Clear formats for reporting results

## Contributing

When adding new shared skills:

1. Use gerund form for naming (e.g., `processing-data`, not `data-processor`)
2. Write descriptions in third person ("Processes data..." not "I process data...")
3. Keep skills under 500 lines (split into reference files if longer)
4. Test with Haiku, Sonnet, and Opus models
5. Remove all repo-specific references
