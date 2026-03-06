# HAR-1352: Linear ticket creation audit

Date: 2026-03-06  
Auditor: Cursor agent

## Executive summary

- **Only one production code path creates Linear tickets in this repository today**: the `issueCreate` GraphQL mutation in `packages/task-list`.
- There are **multiple public entry points** that eventually call that same path (`createTaskList(...)`, `createTaskListClient(...)`, and `Project.createTask(...)`), but they all converge to one implementation.
- No GitHub workflow, script, or other package in this monorepo currently invokes Linear ticket creation directly.

## Scope and method

Searched the full repository for:

- Linear API/mutation usage (`issueCreate`, `IssueCreateInput`, `api.linear.app`)
- Task creation entry points (`createTask`, `createTaskList`, `createTaskListClient`)
- Automation surfaces (`.github/workflows`, root/scripts, package scripts)

## Confirmed Linear ticket creation paths

### 1) Provider-level ticket creation (actual Linear API call)

**File:** `packages/task-list/src/linear/LinearTaskListClient.ts`

- `createContext().createTask(...)` builds the Linear payload and sends:
  - `ISSUE_CREATE_MUTATION` with input containing `teamId`, `stateId`, `title`, optional `projectId`, `description`, `labelIds`, and `priority` (`L186-L209`).
- This is the only place where a Linear ticket is actually created.

Supporting mutation definition:

**File:** `packages/task-list/src/linear/queries.ts`

- `ISSUE_CREATE_MUTATION` is defined as:
  - `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { issue { ... } } }` (`L122-L126`).

### 2) Domain-level entry point that triggers creation

**File:** `packages/task-list/src/Project.ts`

- `Project.createTask(name, options?)` resolves status/labels/priority and calls `this.context.createTask(...)` (`L68-L91`).
- For Linear projects, `context.createTask` resolves to the provider method above.

### 3) Fluent API entry points that funnel into `Project.createTask`

**File:** `packages/task-list/src/TaskList.ts`

- `ProjectRef.createTask(...)` resolves project and calls `project.createTask(...)` (`L60-L65`).

**File:** `packages/task-list/src/index.ts`

- `createTaskList(...)` constructs a fluent `TaskList` using Linear config when:
  - explicit `"linear"` type is provided, or
  - `LINEAR_API_KEY` is present in environment (`L97-L114`).
- `createTaskListClient(...)` returns `LinearTaskListClient` for `type: "linear"` (`L65-L75`).

## Places audited that do NOT create Linear tickets

- `.github/workflows/ci.yml`, `.github/workflows/publish.yml`, `.github/workflows/storybook.yml`: no Linear issue creation logic.
- `scripts/validate-package-manifests.mjs` and `packages/storybook-components/scripts/capture-screenshots.js`: no Linear API usage.
- Other packages in this monorepo: no calls to `createTaskList(...)`, `createTaskListClient(...)`, `Project.createTask(...)`, or `issueCreate`.

## Current-state conclusion

As of this audit, **Linear ticket creation is centralized in one implementation**:

- `packages/task-list/src/linear/LinearTaskListClient.ts` via `ISSUE_CREATE_MUTATION`.

No additional agent/automation code paths in this repository currently create Linear tickets.

## Recommended follow-ups

1. Add a lightweight creation logger/hook in `LinearTaskListClient.createTask` (e.g., structured event with project/status) to make future audits instantaneous.
2. If runtime systems outside this monorepo (bots/services) also create Linear tickets, run the same grep/audit method there and merge results into this report.
