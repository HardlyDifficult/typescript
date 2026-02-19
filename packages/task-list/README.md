I'll analyze the package structure and source code to generate a comprehensive README.Now let me read the Project and Task classes:Now let me check the test files for usage examples:Let me check the linear test file as well:Now let me check the Trello and Linear client implementations to understand their specific features:Perfect! Now I have all the information I need. Let me generate the comprehensive README:

# @hardlydifficult/task-list

Provider-agnostic task list management. One API for Trello, Linear, and future providers — switch by changing config.

## Installation

```bash
npm install @hardlydifficult/task-list
```

## Quick Start

### Fluent API (Recommended)

```typescript
import { createTaskList } from "@hardlydifficult/task-list";

// Auto-detect provider from env vars (LINEAR_API_KEY or TRELLO_API_KEY)
const list = createTaskList();

// Or explicitly specify provider
const list = createTaskList("linear", { team: "MyTeam" });

// Chain operations — no API calls until terminal method
const task = await list
  .getProject("Q1 Roadmap")
  .createTask({
    name: "Fix login bug",
    description: "Users can't log in on mobile",
    labels: ["Bug"],
    status: "To Do",
  });

console.log(task.name); // "Fix login bug"
console.log(task.status); // "To Do"
```

### Raw Client API

```typescript
import { createTaskListClient } from "@hardlydifficult/task-list";

const client = await createTaskListClient({
  type: "linear",
  teamId: "team-uuid",
});

const project = await client.findProject("Q1 Roadmap");
const task = await project.createTask("Fix login", {
  description: "Users can't log in on mobile",
  labels: ["Bug"],
});

await task.update({ status: "Done" });
```

## API Reference

### `createTaskList(type?, options?)`

Fluent entry point for task list operations. Returns a synchronous `TaskList` builder — the chain is sync until a terminal async method.

```typescript
import { createTaskList } from "@hardlydifficult/task-list";

// Auto-detect from env vars
const list = createTaskList();

// Explicit provider
const list = createTaskList("linear", { team: "MyTeam" });
const list = createTaskList("trello");
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `"linear" \| "trello"` | Provider type. If omitted, auto-detects from `LINEAR_API_KEY` or `TRELLO_API_KEY` env vars. |
| `options.team` | `string` | (Linear only) Team name to resolve. Auto-detected for single-team workspaces. |

**Returns:** `TaskList` — a synchronous builder with chainable methods.

**Throws:** Error if no provider is configured and no env vars are set.

---

### `createTaskListClient(config)`

Factory function for raw client API. Async because Linear needs team resolution.

```typescript
import { createTaskListClient } from "@hardlydifficult/task-list";

// Trello (uses TRELLO_API_KEY / TRELLO_API_TOKEN env vars by default)
const client = await createTaskListClient({ type: "trello" });

// Trello with explicit credentials
const client = await createTaskListClient({
  type: "trello",
  apiKey: "your-key",
  token: "your-token",
});

// Linear (uses LINEAR_API_KEY env var by default)
const client = await createTaskListClient({
  type: "linear",
  teamId: "team-uuid",
});

// Linear with team name (resolved via API)
const client = await createTaskListClient({
  type: "linear",
  team: "MyTeam",
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.type` | `"trello" \| "linear"` | Provider type. |
| `config.apiKey` | `string` | (Optional) API key. Defaults to env var. |
| `config.token` | `string` | (Trello only) API token. Defaults to `TRELLO_API_TOKEN` env var. |
| `config.teamId` | `string` | (Linear only) Team UUID. Auto-detected for single-team workspaces. |
| `config.team` | `string` | (Linear only) Team name. Resolved to ID via API. |

**Returns:** `Promise<TaskListClient>` — resolves after team is determined (Linear only).

---

### `TaskList`

Fluent builder for deferred task list operations. All methods are synchronous until a terminal async method is called.

```typescript
const list = createTaskList("linear");

// Chainable — no API call yet
const projectRef = list.getProject("Q1 Roadmap");

// Terminal — triggers API call
const project = await projectRef;
const task = await projectRef.createTask({ name: "Fix bug" });
```

#### `getProject(name): ProjectRef`

Get a deferred project reference by name. Chainable — no API call until a terminal method.

```typescript
const projectRef = list.getProject("Q1 Roadmap");

// Await to fetch the project
const project = await projectRef;

// Or chain directly to createTask
const task = await projectRef.createTask({ name: "New task" });
```

#### `getProjects(): Promise<Project[]>`

Fetch all projects with tasks, statuses, and labels.

```typescript
const projects = await list.getProjects();
console.log(projects.map((p) => p.name)); // ["Q1 Roadmap", "Backlog", ...]
```

#### `getTask(id): TaskRef`

Get a deferred task reference by ID. Chainable — no API call until a terminal method.

```typescript
const taskRef = list.getTask("task-123");

// Await to fetch the task
const task = await taskRef;

// Or chain directly to update
const updated = await taskRef.update({ status: "Done" });
```

---

### `ProjectRef`

Deferred project reference. Thenable — can be awaited to get the full `Project`, or chained with methods.

```typescript
const projectRef = list.getProject("Q1 Roadmap");

// Await to get Project
const project = await projectRef;

// Or chain methods directly
const task = await projectRef.createTask({ name: "Fix bug" });
const tasks = await projectRef.getTasks({ status: "To Do" });
```

#### `createTask(options): Promise<Task>`

Create a task in this project.

```typescript
const task = await list
  .getProject("Q1 Roadmap")
  .createTask({
    name: "Fix login bug",
    description: "Users can't log in on mobile",
    labels: ["Bug"],
    status: "To Do",
    priority: "High",
  });

console.log(task.id); // "task-123"
console.log(task.status); // "To Do"
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Task name/title (required). |
| `description` | `string` | Task description. |
| `labels` | `string[]` | Label names. Resolved to IDs via project context. |
| `status` | `string` | Status name. Defaults to first status in project. |
| `priority` | `"None" \| "Urgent" \| "High" \| "Medium" \| "Low"` | Task priority (Linear only). |

#### `getTasks(filter?): Promise<Task[]>`

Filter tasks in this project. All filter fields use AND logic.

```typescript
const tasks = await list
  .getProject("Q1 Roadmap")
  .getTasks({ status: "To Do", label: "Bug" });

console.log(tasks.length); // 3
```

**Filter Options:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Case-insensitive partial match on status name. |
| `label` | `string` | Case-insensitive partial match on any label. |
| `labels` | `string[]` | All labels must match (case-insensitive exact). |
| `priority` | `Priority` | Exact priority match. |

#### `updateTasks(filter, changes): Promise<BulkUpdateResult>`

Update all tasks matching the filter.

```typescript
const result = await list
  .getProject("Q1 Roadmap")
  .updateTasks({ label: "Bug" }, { status: "Done" });

console.log(result.count); // 5
console.log(result.updated[0].status); // "Done"
```

**Returns:**

```typescript
{
  updated: Task[],  // Updated tasks
  count: number     // Number of tasks updated
}
```

#### `createLabel(name, options?): Promise<Label>`

Create a label for this project/team.

```typescript
const label = await list
  .getProject("Q1 Roadmap")
  .createLabel("Critical", { color: "#ff0000" });

console.log(label.id); // "label-123"
console.log(label.color); // "#ff0000"
```

---

### `TaskRef`

Deferred task reference. Thenable — can be awaited to get the full `Task`, or chained with methods.

```typescript
const taskRef = list.getTask("task-123");

// Await to get Task
const task = await taskRef;

// Or chain methods directly
const updated = await taskRef.update({ status: "Done" });
const withLabel = await taskRef.addLabel("Bug");
```

#### `update(params): Promise<Task>`

Update this task. Returns a new Task with the server state after update.

```typescript
const updated = await list
  .getTask("task-123")
  .update({
    name: "Updated name",
    description: "New description",
    status: "In Progress",
    labels: ["Bug", "Feature"],
    priority: "High",
  });

console.log(updated.name); // "Updated name"
console.log(updated.status); // "In Progress"
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | New task name. |
| `description` | `string` | New description. |
| `status` | `string` | New status name. |
| `labels` | `string[]` | New label names. Replaces all labels. |
| `priority` | `Priority` | New priority (Linear only). |

#### `addLabel(name): Promise<Task>`

Add a label to this task.

```typescript
const task = await list.getTask("task-123").addLabel("Bug");
console.log(task.labels); // ["Feature", "Bug"]
```

#### `removeLabel(name): Promise<Task>`

Remove a label from this task.

```typescript
const task = await list.getTask("task-123").removeLabel("Bug");
console.log(task.labels); // ["Feature"]
```

#### `setStatus(name): Promise<Task>`

Set the task's status.

```typescript
const task = await list.getTask("task-123").setStatus("Done");
console.log(task.status); // "Done"
```

---

### `TaskListClient`

Abstract base class for task list platform clients. Use `createTaskListClient()` to instantiate.

#### `getProjects(): Promise<Project[]>`

Get all projects with full state (statuses, tasks, labels).

```typescript
const client = await createTaskListClient({ type: "linear", teamId: "..." });
const projects = await client.getProjects();
```

#### `getProject(projectId): Promise<Project>`

Get a single project with full state.

```typescript
const project = await client.getProject("proj-123");
console.log(project.name); // "Q1 Roadmap"
console.log(project.tasks.length); // 42
```

#### `getTask(taskId): Promise<Task>`

Get a single task by ID.

```typescript
const task = await client.getTask("task-123");
console.log(task.name); // "Fix login bug"
```

#### `findProject(name): Promise<Project>`

Find a project by name (case-insensitive partial match).

```typescript
const project = await client.findProject("Q1");
console.log(project.name); // "Q1 Roadmap"
```

**Throws:** Error if no project matches.

---

### `Project`

A project (Trello Board, Linear Project) with task creation capability.

```typescript
const project = await client.getProject("proj-123");

console.log(project.id); // "proj-123"
console.log(project.name); // "Q1 Roadmap"
console.log(project.url); // "https://linear.app/..."
console.log(project.statuses); // [{ id: "s1", name: "To Do" }, ...]
console.log(project.labels); // [{ id: "l1", name: "Bug", color: "#ff0000" }, ...]
console.log(project.tasks); // [Task, Task, ...]
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Project identifier. |
| `name` | `string` | Project name. |
| `url` | `string` | Project URL. |
| `statuses` | `Status[]` | Available statuses with ID and name. |
| `labels` | `Label[]` | Available labels with ID, name, and color. |
| `tasks` | `Task[]` | All tasks in the project (eagerly loaded). |

#### `createTask(name, options?): Promise<Task>`

Create a task in this project.

```typescript
const task = await project.createTask("Fix bug", {
  description: "Users can't log in",
  labels: ["Bug"],
  status: "To Do",
  priority: "High",
});
```

#### `findTask(taskId): Task`

Find a task by ID within the loaded tasks.

```typescript
const task = project.findTask("task-123");
console.log(task.name); // "Fix bug"
```

**Throws:** Error if task not found.

#### `getTasks(filter?): Task[]`

Filter the loaded tasks by criteria. All filter fields use AND logic.

```typescript
const bugs = project.getTasks({ label: "Bug", status: "To Do" });
console.log(bugs.length); // 3
```

#### `updateTasks(filter, changes): Promise<BulkUpdateResult>`

Update all tasks matching the filter.

```typescript
const result = await project.updateTasks(
  { label: "Bug" },
  { status: "Done" }
);
console.log(result.count); // 5
```

#### `findStatus(name): Status`

Find a status by name (case-insensitive partial match).

```typescript
const status = project.findStatus("to do");
console.log(status.id); // "s1"
console.log(status.name); // "To Do"
```

#### `findLabel(name): Label`

Find a label by name (case-insensitive partial match).

```typescript
const label = project.findLabel("bug");
console.log(label.id); // "l1"
console.log(label.color); // "#ff0000"
```

#### `createLabel(name, options?): Promise<Label>`

Create a label for this project/team.

```typescript
const label = await project.createLabel("Critical", { color: "#ff0000" });
console.log(label.id); // "l2"
```

#### `deleteLabel(name): Promise<void>`

Delete a label by name.

```typescript
await project.deleteLabel("Critical");
```

---

### `Task`

A task (Trello Card, Linear Issue) with update capability. Status and labels are exposed as human-readable names.

```typescript
const task = await project.createTask("Fix bug");

console.log(task.id); // "task-123"
console.log(task.name); // "Fix bug"
console.log(task.description); // ""
console.log(task.status); // "To Do"
console.log(task.projectId); // "proj-123"
console.log(task.labels); // []
console.log(task.url); // "https://linear.app/..."
console.log(task.priority); // undefined
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Task identifier. |
| `name` | `string` | Task name. |
| `description` | `string` | Task description. |
| `