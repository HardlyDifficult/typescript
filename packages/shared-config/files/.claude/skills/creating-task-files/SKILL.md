---
name: creating-task-files
description: Creates structured task documentation for AI-assisted implementation. Use when starting significant work, planning features, or when task files are mentioned.
---

# Creating Task Files

Document work to be done with comprehensive context for AI implementation.

## Location

```
<repository>/tasks/YYYY/MM/DD/YYYY.MM.DD-short-description.md
```

Where `DD` = developer initials (ask if unknown).

## Process

1. **Clarify scope** - Ask questions to understand requirements
2. **Gather context** - Search codebase, find similar code, check ADRs
3. **Create task file** - Use structure below with comprehensive context
4. **Create tracking issue** - Register task in issue tracker if applicable

## Context Engineering

AI output quality depends on context quality.

### Techniques

**1. Use @ mentions for file references**
```
@CLAUDE.md              # Repository context
@src/hooks/useAuth.ts   # Related code
@docs/adr/001-*.md      # Relevant ADRs
```

**2. Include similar code as reference**

Best context is similar existing code:
> "Build an auth flow similar to `@src/features/auth/` but for admin portal"

**3. Reference external documentation**

Many libraries provide AI-optimized docs (llms.txt):
- Privy: https://docs.privy.io/llms.txt
- Mantine: https://mantine.dev/llms.txt

**4. Add artifacts**
- Screenshots of current UI or errors
- Error logs and stack traces
- API response samples
- Database schema docs

### Context Checklist

Before creating task file:
- [ ] Referenced repository's CLAUDE.md
- [ ] Found related existing code
- [ ] Checked ADRs for architectural constraints
- [ ] Added library docs if using external APIs
- [ ] Included screenshots/logs if relevant

## Task File Structure

```markdown
# Task: [Title]

**Date**: YYYY-MM-DD
**Author**: [Initials]
**Status**: Planning | In Progress | Testing | Complete
**PR**: (link when created)
**Issue**: (link when created)

## Goal
One sentence describing the outcome.

## Context
Why this is needed. Reference related code and docs.

## Scope
### In Scope
- [ ] Item 1
- [ ] Item 2

### Out of Scope
- Item not addressed

## Implementation Plan
### 1. [Step Name]
Description.

**Files to modify:**
- `path/to/file.ts` — What changes

## Testing Strategy
- [ ] Unit tests for X
- [ ] Integration tests for Y

## Notes / Decisions Made
(Log changes from original plan during implementation)
```

## Issue Tracker Integration

After creating task file, create issue for visibility (if using issue tracker).

**Issue format:**
- **Title**: `[repo-name] Task title`
- **Description**: Brief summary + link to task file
- **Labels**: Add relevant labels
- **Priority**: Set based on urgency

**After creating:**
1. Add issue URL to task file's `**Issue**:` field
2. Confirm both are linked bidirectionally

## Quality Checklist

- [ ] Goal is clear in one sentence
- [ ] Context includes relevant file references
- [ ] Scope explicitly lists in/out items
- [ ] Implementation plan has concrete steps
- [ ] Files to modify are identified
- [ ] Testing strategy is defined
- [ ] Issue created and linked (if applicable)
