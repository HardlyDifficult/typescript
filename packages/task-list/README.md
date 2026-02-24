# @hardlydifficult/task-list

Provider-agnostic task list management. One API for Trello, Linear, and future providers — switch by changing config.

## Features

- **Unified API**: Consistent interfaces across platforms (Linear, Trello).
- **Domain-Driven Design**: Rich `Task`, `Project`, and `TaskWatcher` classes.
- **Type Safety**: Fully typed with TypeScript interfaces.
- **Platform Abstraction**: Provider-specific logic lives in dedicated implementations.
- **Task Watching**: `TaskWatcher` polls for tasks and dispatches them with automatic deduplication.

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

### Linear

```typescript
import { createTaskListClient } from "@hardlydifficult/task-list";

const client = await createTaskListClient({ type: "linear", teamId: "..." });
const projects = await client.getProjects();
const todoTasks = projects[0]!.getTasks({ status: "Todo" });
```

### Trello

```typescript
import { createTaskListClient } from "@hardlydifficult/task-list";

const client = await createTaskListClient({ type: "trello" });
const project = await client.findProject("My Board");
const tasks = project.getTasks({ label: "Bug" });
```

## Core Concepts

### Task

Represents a unit of work (Linear issue, Trello card). Exposes platform-agnostic fields:

- `id`, `name`, `description`, `status`, `projectId`, `labels`, `url`, `priority`
- Methods: `update()`, `addLabel()`, `removeLabel()`, `setStatus()`

```typescript
const updated = await task.update({ status: "In Progress" });
```

### Project

Represents a container for tasks (Linear project, Trello board). Exposes:

- `id`, `name`, `url`, `statuses`, `labels`, `tasks`
- Methods: `createTask()`, `findTask()`, `getTasks()`, `updateTasks()`, `createLabel()`, `deleteLabel()`

```typescript
const tasks = project.getTasks({ status: "Todo", label: "Bug" });
```

### TaskWatcher

Watches a project for tasks in a trigger status and dispatches them:

```typescript
const watcher = new TaskWatcher(client, {
  projectName: "Bot",
  triggerStatus: "Todo",
  pickupStatus: "In Progress",
  pollIntervalMs: 60_000,
  onTask: (task, project) => console.log("Found:", task.name),
});
watcher.start();
```

Deduplication happens automatically by moving tasks to `pickupStatus`.

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
| `getProjects()` | `Project[]` | All projects |
| `getProject(projectId)` | `Project` | Single project with statuses, tasks, and labels |
| `getTask(taskId)` | `Task` | Single task by ID |
| `findProject(name)` | `Project` | Find project by name (case-insensitive partial match) |

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
| `getTasks(filter?)` | `readonly Task[]` | Get tasks with optional filtering |
| `updateTasks(filter, changes)` | `BulkUpdateResult` | Bulk update tasks |
| `createLabel(name, options?)` | `Label` | Create a new label |
| `deleteLabel(name)` | `void` | Delete a label |
| `findStatus(name)` | `Status` | Find status by name |
| `findLabel(name)` | `Label` | Find label by name |

Options for `createTask`: `{ description?: string, status?: string, labels?: string[], priority?: Priority }`

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
| `priority` | `Priority` | Task priority |

| Method | Returns | Description |
|--------|---------|-------------|
| `update(params)` | `Task` | Update and return new Task with server state |
| `addLabel(name)` | `Task` | Add a label to the task |
| `removeLabel(name)` | `Task` | Remove a label from the task |
| `setStatus(name)` | `Task` | Update task status |

Params for `update`: `{ name?: string, description?: string, status?: string, labels?: string[], priority?: Priority }`

## Concept Mapping

| Abstraction | Trello | Linear |
|-------------|--------|--------|
| **Project** | Board | Project |
| **Status** | List | WorkflowState |
| **Task** | Card | Issue |
| **Label** | Label | IssueLabel |

## Supported Providers

- **Trello** — fully implemented
- **Linear** — fully implemented

## Configuration

Environment variables (optional):

```bash
export LINEAR_API_KEY=...
export TRELLO_API_KEY=...
export TRELLO_API_TOKEN=...
```

Programmatic config:

```typescript
const client = await createTaskListClient({
  type: "linear",
  apiKey: "lin_...",
  teamId: "team-id",
});
```

## API Reference

### Types

```typescript
type Priority = "None" | "Urgent" | "High" | "Medium" | "Low";

interface TaskFilter {
  label?: string;
  labels?: readonly string[];
  status?: string;
  priority?: Priority;
}

interface UpdateTaskParams {
  name?: string;
  description?: string;
  status?: string;
  labels?: readonly string[];
  priority?: Priority;
}

interface CreateTaskOptions {
  description?: string;
  labels?: readonly string[];
  status?: string;
  priority?: Priority;
}
```

## Error Handling

All errors extend `TaskListError` with a `code` property:

- `UNKNOWN_PROVIDER`
- `PROVIDER_NOT_CONFIGURED`
- `PROJECT_NOT_FOUND`
- `TASK_NOT_FOUND`
- `STATUS_NOT_FOUND`
- `LABEL_NOT_FOUND`
- `TEAM_NOT_FOUND`
- `NO_TEAMS_FOUND`
- `MULTIPLE_TEAMS_FOUND`
- `TEAM_NOT_RESOLVED`
- `API_ERROR`
- `LINEAR_GRAPHQL_ERROR`
- `INVALID_PRIORITY`

```typescript
try {
  const project = await client.findProject("Missing");
} catch (error) {
  if (error.code === "PROJECT_NOT_FOUND") {
    console.error("Project not found");
  }
}
```

## Extending

Implement `TaskListClient` for new platforms:

1. Create `YourPlatformTaskListClient` extending `TaskListClient`.
2. Implement `getProjects()`, `getProject()`, `getTask()`.
3. Provide a `TaskContext` with provider-specific logic (API calls, name resolution).

See `LinearTaskListClient` and `TrelloTaskListClient` for examples.

## Testing

```bash
npm test
npm run test:coverage
```

## License

MIT