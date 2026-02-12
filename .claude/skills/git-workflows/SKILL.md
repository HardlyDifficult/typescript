---
name: git-workflows
description: Git and GitHub workflows for pull, sync, commit, push, and PR operations. Use for git operations, branch management, or when pull requests are mentioned.
---

# Git & GitHub Workflows

## Quick Reference

| Action | Trigger phrases |
|--------|-----------------|
| Sync with remote | "pull", "sync", "update from main" |
| Commit changes | "commit", "save changes" |
| Create pull request | "PR", "create a PR", "submit for review" |
| Reset to main | "reset to main", "start fresh" |

## Workflow Composition

Workflows build on each other:

```
PR → Commit → Pull
```

- Creating PR first commits changes
- Committing first pulls latest from main

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

### Monitor PR After Every Push

After every push to a PR branch, **always** monitor CI and review comments:

1. **Check CI status** using `GH_TOKEN="$GH_PAT" gh pr checks <number> --repo <owner>/<repo>`
2. If CI fails: investigate, fix, push, and repeat
3. **Fetch review comments** using `GH_TOKEN="$GH_PAT" gh api repos/<owner>/<repo>/pulls/<number>/comments`
4. Address actionable feedback (fix code, add tests, etc.)
5. Push fixes and repeat until CI is green and no unresolved comments remain

This monitoring step is **not optional** — always do it after pushing.

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
