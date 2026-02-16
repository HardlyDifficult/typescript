# @hardlydifficult/task-list

Provider-agnostic task list management. One API for Trello, Linear, and future providers — switch by changing config.

## Installation

```bash
npm install @hardlydifficult/task-list
```

## Quick Start

```typescript
import { createTaskListClient } from "@hardlydifficult/task-list";

// Trello
const trello = createTaskListClient({ type: "trello" });

// Linear
const linear = createTaskListClient({
  type: "linear",
  teamId: "team-uuid",
});

// Find a project and create a task
const project = await linear.findProject("Q1 Roadmap");

const task = await project.createTask("Fix login", {
  description: "Users can't log in on mobile",
  labels: ["Bug"],
});

// Update a task
await task.update({ status: "Done" });
```

## API

### `createTaskListClient(config)`

Factory function — returns a `TaskListClient` based on config type.

```typescript
// Trello (uses TRELLO_API_KEY / TRELLO_API_TOKEN env vars by default)
const client = createTaskListClient({ type: "trello" });

// Trello with explicit credentials
const client = createTaskListClient({
  type: "trello",
  apiKey: "your-key",
  token: "your-token",
});

// Linear (uses LINEAR_API_KEY env var by default)
const client = createTaskListClient({
  type: "linear",
  teamId: "team-uuid",
});

// Linear with explicit API key
const client = createTaskListClient({
  type: "linear",
  apiKey: "lin_xxx",
  teamId: "team-uuid",
});
```

### `TaskListClient`

| Method | Returns | Description |
|--------|---------|-------------|
| `getProjects()` | `FullState` | All projects with statuses, tasks, and labels |
| `getProject(projectId)` | `Project` | Single project with statuses, tasks, and labels |
| `getTask(taskId)` | `Task` | Single task by ID |
| `findProject(name)` | `Project` | Find project by name (case-insensitive partial match) |

### `FullState`

| Property | Type | Description |
|----------|------|-------------|
| `projects` | `Project[]` | All projects |

| Method | Returns | Description |
|--------|---------|-------------|
| `findProject(name)` | `Project` | Find by name (case-insensitive partial match) |
| `findTask(taskId)` | `Task` | Find task by ID across all projects |

### `Project`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Project identifier |
| `name` | `string` | Project name |
| `url` | `string` | Project URL |
| `statuses` | `string[]` | Available status names |
| `labels` | `string[]` | Available label names |
| `tasks` | `Task[]` | All tasks in the project |

| Method | Returns | Description |
|--------|---------|-------------|
| `createTask(name, options?)` | `Task` | Create a task in this project |
| `findTask(taskId)` | `Task` | Find task by ID |

Options: `{ description?: string, status?: string, labels?: string[] }`

### `Task`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Task identifier |
| `name` | `string` | Task name |
| `description` | `string` | Task description |
| `status` | `string` | Current status name |
| `projectId` | `string` | Parent project ID |
| `labels` | `string[]` | Label names |
| `url` | `string` | Task URL |

| Method | Returns | Description |
|--------|---------|-------------|
| `update(params)` | `Task` | Update and return new Task with server state |

Params: `{ name?: string, description?: string, status?: string, labels?: string[] }`

## Concept Mapping

| Abstraction | Trello | Linear |
|---|---|---|
| **Project** | Board | Project |
| Status | List | WorkflowState |
| **Task** | Card | Issue |
| Label | Label | IssueLabel |

## Supported Providers

- **Trello** — fully implemented
- **Linear** — fully implemented
