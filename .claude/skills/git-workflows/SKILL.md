---
name: git-workflows
description: Git and GitHub workflows for pull, sync, commit, push, PR, review loop, and reset. Use for git operations, branch management, PR creation, "run the review loop", "wait for bot feedback", "iterate on PR", or when pull requests are mentioned.
---

# Git & GitHub Workflows

## Quick Reference

| Action | Trigger phrases |
|--------|-----------------|
| Sync with remote | "pull", "sync", "update from main" |
| Commit changes | "commit", "save changes" |
| Create pull request | "PR", "create a PR", "submit for review" |
| Run review loop | "run the review loop", "wait for bot feedback", "iterate on PR", "check PR status" |
| Reset to main | "reset to main", "start fresh" |

## Workflow Composition

Workflows build on each other:

```
PR Review Loop → PR → Commit → Pull
```

- Creating PR first commits changes
- Committing first pulls latest from main
- After PR creation, enter the PR Review Loop

---

## Pull Workflow

Pull latest changes and sync with remote.

### Scope

- **Single repo**: If specific repo mentioned or clearly working in one, only pull that repo
- **All repos**: If "all" is said or unspecified, pull all git repos in workspace

### On `main` branch

- **Clean working directory**: `git pull origin main`
- **Has uncommitted changes**: `git stash && git pull origin main && git stash pop` — resolve conflicts but do NOT push

### On feature branch

1. Merge latest main: `git fetch origin && git merge origin/main`
2. Push the branch: `git push`

### Rules

- **Never force push**
- Summarize results for each repo

---

## Commit Workflow

Commit changes to current branch.

### Before Committing

1. **Pull latest** - Sync with main using pull workflow
2. **Run checks** - Lint, format, build, test, and any repo-specific commands
3. **Fix issues** - Fix all warnings and errors

### Commit

1. Stage relevant changes
2. Write clear, concise commit message focused on the "why"
3. Commit the changes

---

## PR Workflow

Create a PR against main.

### Before Creating PR

1. **Pull and merge main** - Always fetch and merge latest main first:
   ```bash
   git fetch origin && git merge origin/main
   ```
   Resolve any merge conflicts before proceeding.
2. **Commit changes** - Apply commit workflow (runs checks)
3. Create new branch if needed

### Create the PR

1. Push to remote (with `-u` flag if new branch)
2. Create PR using `gh` CLI
3. Open browser tab to the PR's `/files` page: `open <pr-url>/files`
4. Return the PR URL as **clickable markdown link**: `[PR #N](url)`

### Output Format

Always format URLs as clickable markdown links:
- PR link: `[PR #123](https://github.com/owner/repo/pull/123)`
- Any other URLs should also be linked

### GitHub CLI Authentication

Always prefix `gh` commands with the PAT env var:
```bash
GH_TOKEN="$GH_PAT" gh <command>
```

### After PR Creation

Enter the **PR Review Loop** below to monitor CI, process bot feedback, and iterate until ready for human review.

---

## PR Review Loop

Automates the post-push review cycle: push → wait for bots → analyze feedback → fix → repeat.

### Prerequisites

- Active PR branch checked out
- `gh` CLI authenticated

### Step 1: Push and get PR info

```bash
git push
GH_TOKEN="$GH_PAT" gh pr view --json number,url -q '{number: .number, url: .url}'
```

If no PR exists for the current branch, create one using the PR Workflow above.

### Step 2: Wait for bot reviews

Poll until all checks complete:

```bash
GH_TOKEN="$GH_PAT" gh pr view <PR_NUMBER> --json statusCheckRollup -q '.statusCheckRollup[]? | select(.name != null) | "\(.status) | \(.conclusion // "pending") | \(.name)"' | sort
```

| Status | Conclusion | Action |
|--------|------------|--------|
| `IN_PROGRESS` | — | Wait, re-check in 30-60s |
| `COMPLETED` | `SUCCESS` | Passed |
| `COMPLETED` | `FAILURE` | Fetch feedback (Step 3) |
| `COMPLETED` | `SKIPPED` | Ignore |

Quick summary:

```bash
PR_NUMBER=$(GH_TOKEN="$GH_PAT" gh pr view --json number -q '.number')
IN_PROGRESS=$(GH_TOKEN="$GH_PAT" gh pr view "$PR_NUMBER" --json statusCheckRollup -q '[.statusCheckRollup[]? | select(.status == "IN_PROGRESS")] | length')
FAILED=$(GH_TOKEN="$GH_PAT" gh pr view "$PR_NUMBER" --json statusCheckRollup -q '[.statusCheckRollup[]? | select(.conclusion == "FAILURE")] | length')
SUCCESS=$(GH_TOKEN="$GH_PAT" gh pr view "$PR_NUMBER" --json statusCheckRollup -q '[.statusCheckRollup[]? | select(.conclusion == "SUCCESS")] | length')
echo "Passed: $SUCCESS | Failed: $FAILED | In Progress: $IN_PROGRESS"
```

### Step 3: Fetch bot feedback

```bash
REPO=$(GH_TOKEN="$GH_PAT" gh repo view --json nameWithOwner -q '.nameWithOwner')

# Issue comments (bot summary feedback)
GH_TOKEN="$GH_PAT" gh api "repos/$REPO/issues/<PR_NUMBER>/comments" \
  -q '.[-3:] | .[] | select(.user.login | test("bot|codex|claude|github-actions"; "i")) | {user: .user.login, created: .created_at, body: .body[0:2500]}'

# Review comments (inline code feedback)
GH_TOKEN="$GH_PAT" gh api "repos/$REPO/pulls/<PR_NUMBER>/comments" \
  -q '.[-5:] | .[] | {user: .user.login, path: .path, line: .line, body: .body[0:1000]}'
```

### Step 4: Analyze and prioritize

| Priority | Type | Action |
|----------|------|--------|
| **High** | Bugs, security, broken tests, build failures | Must fix |
| **Medium** | Code quality, missing error handling | Should fix |
| **Low** | Style nits, minor suggestions | Fix if quick |

Skip: approval messages, status updates without concrete feedback, duplicate bot comments.

### Step 5: Fix and verify

1. Fix **High** first, then **Medium**
2. Run lint and tests locally
3. Verify fixes resolve the flagged issues

### Step 6: Push and repeat

```bash
git add -A && git commit -m "Address review feedback" && git push
```

Return to **Step 2**.

### Exit conditions

Stop when **all** true:
1. All checks `COMPLETED` + `SUCCESS`
2. No new High/Medium issues in latest feedback
3. Bot feedback says "No blocking issues" or equivalent

**Safety valve:** After **5 iterations** on the same issue, summarize blockers for human input.

### Breaking review cycles

If bots keep flagging the same issue:
1. Read the **full** error output — fix may be incomplete
2. Check the pushed diff (not just local state) to confirm fix is included
3. After 2-3 cycles on same issue, escalate to human review

### Output template

```markdown
## PR Review Summary

**PR:** #<number> - <title>
**Iterations:** <count>

### Fixed Issues
1. [High] <description>
2. [Medium] <description>

### Remaining Items
- <item> — <reason>

### Status Checks
- lint-and-test: ✓/✗
- claude-review: ✓/✗
- github-actions: ✓/✗

**Ready for human review:** Yes/No
```

### Tips

- 429 errors: wait 60s before retrying
- Open PR in browser: `GH_TOKEN="$GH_PAT" gh pr view <PR_NUMBER> --web`
- Full CI logs: `GH_TOKEN="$GH_PAT" gh run list --branch <branch>` then `GH_TOKEN="$GH_PAT" gh run view <run-id> --log-failed`

---

## Reset to Main Workflow

Reset repos to clean `main` branch state.

### Trigger

- "reset to main", "start fresh", "clean slate"

### Process

For **each git repo** in workspace:

1. **Check for uncommitted changes**: `git status --porcelain`
2. **If changes exist**: Stash with descriptive message
   ```bash
   git stash push -m "Auto-stash before reset: $(date +%Y-%m-%d)"
   ```
3. **Switch to main**: `git checkout main`
4. **Pull latest**: `git pull origin main`
5. **Install dependencies**: `npm i` (if `package.json` exists)

Track which repos had stashes created.

### Output Summary

After processing, provide summary:

```markdown
## Reset Complete

| Repo | Stashed? | Stash Summary |
|------|----------|---------------|
| repo1 | Yes | 2 modified files: src/index.ts, package.json |
| repo2 | No | - |
| repo3 | Yes | 1 new file: test/draft.ts |
```

For stashed repos, include:
- Number of files affected
- Key file names (truncate if many)
- Type of changes (modified, new, deleted)

### Recovering Stashed Changes

```bash
# View stashes
git stash list

# Apply most recent stash (keeps stash)
git stash apply

# Apply and remove stash
git stash pop
```
