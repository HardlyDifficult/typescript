---
name: coordinating-subagents
description: Coordinates multiple subagents for complex tasks through parallelization and context isolation. Use when planning multi-step work, coordinating workstreams, or when tasks benefit from parallel execution.
---

# Coordinating Subagents

Subagents are specialized agents that handle discrete parts of larger tasks. They run in parallel, maintain isolated context, and can be configured with custom models and tools.

**Use subagents liberally** for faster execution, focused context, and specialized expertise.

## When to Use Subagents

**Strong signals:**
- Task involves multiple files, repos, or domains
- Work can be separated into independent pieces
- Context is growing large (many files, long conversation)
- Multiple items need parallel analysis or review
- Specialized behavior needed (different model or tools)

### The Master-Subagent Pattern

```
Master Agent (Coordinator)
    │
    ├── Subagent A (focused task)
    ├── Subagent B (focused task)
    └── Subagent C (focused task)
```

**Master responsibilities:**
- Break down goals into discrete tasks
- Launch subagents with clear, focused prompts
- Synthesize results and share learnings
- Make high-level decisions
- Coordinate dependencies

**Subagent responsibilities:**
- Execute one specific, well-defined task
- Maintain focused context (only load what's needed)
- Report results clearly
- Avoid scope creep

## Why Context Isolation Matters

AI agents degrade as context grows. Symptoms:
- Missing important details
- Inconsistent behavior
- Slower responses
- Hallucinations or confusion

**Subagents solve this** by starting fresh with only needed context. A subagent reviewing one PR doesn't carry baggage from other PRs.

## Crafting Effective Subagent Prompts

Include:

1. **Clear objective** - Expected outcome
2. **Necessary context** - File paths, numbers, relevant background
3. **Constraints** - What not to do, scope boundaries
4. **Expected output** - Format and content of report

### Example: PR Review Subagent

```
Review PR #42 in the repository.
Branch: feature/add-auth | URL: https://github.com/org/repo/pull/42

## Objective
Ensure this PR is correct, complete, and follows repo patterns.

## Steps
1. Checkout the branch
2. Read the diff and understand changes
3. Run lint, build, and tests
4. Fix any issues found
5. Review for code quality

## Report Back
- Summary of what the PR does
- Issues found and fixed
- Any concerns or risks
- READY or NEEDS_HUMAN_INPUT
```

### Example: File Analysis Subagent

```
Analyze the authentication flow in the codebase.

## Objective
Map how authentication works from login to token refresh.

## Files to examine
- src/auth/login.ts
- src/auth/token.ts
- src/middleware/auth.ts

## Report Back
- Flow diagram or description
- Key functions and their roles
- Potential issues or improvements
```

## Sharing Learnings Between Subagents

When subagents discover cross-cutting information:

1. **Subagent reports finding** - Include in structured output
2. **Master identifies patterns** - Recognize when finding applies elsewhere
3. **Master informs other subagents** - Add to their prompts or follow-up

### Example Flow

```
Subagent A: "Found that all API calls need X-Request-ID header"

Master Agent: Recognizes this applies to Subagent B and C
              Updates their tasks with this requirement

Subagent B & C: Apply learning to their work
```

## Anti-Patterns

### ❌ One Agent Does Everything

Problem: Context becomes massive, quality degrades
Solution: Split into focused subagents

### ❌ Subagent Scope Creep

Problem: Subagent expands beyond assigned task
Solution: Clear boundaries in prompt, explicit "out of scope" section

### ❌ No Information Sharing

Problem: Subagents duplicate work or miss cross-cutting concerns
Solution: Master actively synthesizes and redistributes learnings

### ❌ Over-Decomposition

Problem: Too many tiny subagents with coordination overhead
Solution: Balance—each subagent should have meaningful, coherent work

## Practical Guidelines

### Minimum Viable Subagent

Use a subagent if the task:
- Would add 5+ files to context
- Takes more than a few steps
- Is logically independent from other work

### Subagent Output Format

Request structured output for easy synthesis:

```markdown
## Summary
[One paragraph]

## Key Findings
- Finding 1
- Finding 2

## Actions Taken
- Action 1
- Action 2

## Status
[COMPLETE | NEEDS_INPUT | BLOCKED]

## Notes for Other Agents
[Cross-cutting learnings]
```

### Parallelization

Launch independent subagents simultaneously. Only serialize when:
- One subagent's output is another's input
- Shared resources would conflict (same branch, same file)
