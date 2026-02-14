---
name: gg
description: Capture learnings and best practices from the current session. Use when the user says "gg", expresses satisfaction, or after completing complex tasks.
argument-hint: <optional: summary of what went well>
---

# GG: Capture Session Learnings

When the user says "gg", review the session and update docs with anything useful for future sessions.

## What to Capture

- **Platform differences** discovered (e.g., emoji handling, missing fields in events)
- **Testing patterns** that were tricky (fake timers, async mocking, unhandled rejections)
- **Architecture decisions** (where to add methods, when to override in subclasses)
- **Pitfalls** and how to avoid them
- **Successful workflows** worth repeating

## Where to Update

1. **`CLAUDE.md`** (project root) — Project-wide principles, API patterns, testing tricks
2. **`.claude/skills/*/SKILL.md`** — Skill-specific improvements
3. **Package `README.md`** — New capabilities or API changes

## Process

1. Review the session for key learnings
2. Check existing docs — merge into existing sections rather than duplicating
3. Rewrite existing content if it can be more concise or accurate
4. Add new entries under the most relevant section
5. Remove anything that turned out to be wrong or stale
6. Commit: `docs: update with session learnings`

## Guidelines

- **Concise and scannable** — bullet points over paragraphs
- **Actionable** — specific examples over general advice
- **Honest** — update or remove guidance that proved wrong
- **Consolidate** — fewer, better-written sections beat many scattered notes
