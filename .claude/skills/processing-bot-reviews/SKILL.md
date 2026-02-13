---
name: processing-bot-reviews
description: Triage and process AI bot review findings. Use when handling review reports, fixing PR feedback, or when mentions of "review report", "bot findings", "fix feedback", "triage reviews", "false positive", review cycles, or automated feedback appear. For the full push-wait-fix loop, see the git-workflows skill.
---

# Processing Bot Reviews

Analyze and triage AI bot review findings. For the full automated push → wait → fix → repeat loop, use the **git-workflows skill's PR Review Loop**.

## Triage Workflow

For each finding: **Read → Verify → Classify → Act**.

Before acting, confirm:
- [ ] Flagged code still exists (hasn't been refactored away)
- [ ] Issue is reproducible or logically valid
- [ ] Suggested fix wouldn't break other functionality
- [ ] Finding isn't a duplicate of one already addressed

## Classifying Findings

| Signal | Classification | Action |
|--------|---------------|--------|
| Real bug or crash path | **Real — High** | Fix immediately |
| Missing error handling or edge case | **Real — Medium** | Fix this iteration |
| Style preference or naming nit | **Real — Low** | Fix if quick, skip otherwise |
| Code already fixed in later commit | **False positive** | Skip, note in summary |
| Bot misread code structure | **False positive** | Skip, note in summary |
| Flagged pattern is intentional | **False positive** | Skip, note in summary |

**False positives:** Don't change code to satisfy incorrect findings. Note and move on.

## Inline vs Summary Comments

- **Inline comments** (on specific lines): Higher signal, address first. Use `path` and `line` to navigate.
- **Summary comments** (on PR): Extract specific code references, skip generic messages ("LGTM", "No blocking issues").

## Breaking Review Cycles

| Iteration | Action |
|-----------|--------|
| 1st flag | Fix the issue |
| 2nd flag (same issue) | Verify fix is in pushed diff, not just local |
| 3rd flag (same issue) | Read full bot output — may be a different aspect |
| 4th+ flag | Stop. Mark as needing human review |

Common causes: fix not pushed, symptom fixed but not root cause, stale bot context, conflicting bot opinions.

## Good Finding Format

**Good:**
```
src/auth.ts:34-56 - Function doesn't handle null values.
Add null check before accessing user.email.
```

**Bad:**
```
The code could be better.
```

## Output Template

```markdown
## Review Triage Summary

**Fixed (N):**
- `src/auth.ts:34` — Added null check for user.email [High]
- `src/api.ts:89` — Added error handling for timeout [Medium]

**False Positives (N):**
- `src/utils.ts:12` — Already handled by type guard on line 8

**Needs Human Input (N):**
- `src/config.ts:45` — Unclear if env var should be required
```

## Before Pushing Fixes

1. Run lint and tests
2. Verify no regressions from fixes
3. Commit: `git commit -m "Address review feedback: <summary>"`
