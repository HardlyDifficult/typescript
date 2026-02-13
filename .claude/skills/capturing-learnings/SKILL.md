---
name: capturing-learnings
description: Captures session learnings into documentation after completing tasks. Use when the user says "gg", expresses satisfaction, or after completing complex tasks.
argument-hint: <optional: summary of what went well>
---

# Capturing Session Learnings

After completing work, capture useful patterns and insights for future reference.

## When to Trigger

- User says "gg" or expresses satisfaction with completed work
- After completing complex multi-file tasks
- When new patterns, pitfalls, or workflow insights are discovered

## What to Document

- **Platform differences** discovered (e.g., emoji handling, missing fields in events)
- **Testing patterns** that were tricky to get right (fake timers, async mocking, unhandled rejections)
- **Architecture decisions** about where to add new methods (Channel vs ChannelOperations, when to override in subclasses)
- **Common pitfalls** and how to avoid them
- **Successful workflows** worth repeating

## Where to Update

1. **`CLAUDE.md`** (project root) - Project-wide principles, API change checklists, testing patterns
2. **`.claude/skills/*/SKILL.md`** - Skill-specific improvements
3. **Package `README.md`** - When adding new capabilities (already handled during implementation)

## Process

1. Review the session for key learnings
2. Check if CLAUDE.md already covers the topic — merge rather than duplicate
3. Add concise, actionable entries under the relevant section
4. Commit with message: "Update CLAUDE.md with session learnings"
5. Push to the current branch

## Guidelines

- Keep updates concise and scannable
- Focus on actionable insights, not narratives
- Use consistent terminology with existing docs
- Prefer specific examples over general advice
