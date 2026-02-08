---
name: processing-bot-reviews
description: Processes AI bot review findings systematically. Use when handling review reports, fixing PR feedback, or when mentions of review cycles, bot findings, or automated feedback appear.
---

# Processing Bot Reviews

Systematically process AI bot review findings.

## Review Processing Steps

1. **Verify** - Confirm the issue exists and is worth fixing
2. **Prioritize** - Focus on real issues, skip false positives
3. **Fix** - Apply fixes with tests
4. **Document** - Update docs if needed

## Workflow

When given review findings:

1. Read each finding carefully
2. Check if the issue exists in current code
3. Determine if it's real or a false positive
4. Fix real issues, note false positives
5. Run lint/tests before pushing

## Breaking Review Cycles

If bots keep flagging the same "fixed" issues:

1. **Pre-filter**: "Review these findings and identify which are real vs false positives"
2. **After 2-3 cycles**: Manually verify the PR diff
3. **Stop when**:
   - No new findings, OR
   - All remaining are verified false positives

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

## Output Format

When reporting on review processing:

```markdown
## Review Summary

**Fixed:**
- src/auth.ts:34 - Added null check for user.email

**False Positives (skipped):**
- src/utils.ts:12 - Already handled by type guard on line 8

**Needs Human Input:**
- src/config.ts:45 - Unclear if env var should be required
```
