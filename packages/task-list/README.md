# @hardlydifficult/task-list

Provider-agnostic task list management. One API for Trello, Linear, and future providers — switch by changing config.

## Installation

```bash
npm install @hardlydifficult/task-list
```

## Quick Start

```typescript
import { createTaskListClient } from "@hardlydifficult/task-list";

const client = createTaskListClient({ type: "trello" });

// Get all boards with full state
const state = await client.getBoards();

// Chainable lookups
const list = state.findBoard("My Project").findList("To Do");
const label = state.findBoard("My Project").findLabel("Bug");

// Create a task
const task = await list.createTask("Fix login page", {
  description: "Users can't log in on mobile",
  labels: [label],
});

// Update a task
await task.update({ name: "Fixed login page" });

// Move to another list
const doneList = state.findBoard("My Project").findList("Done");
await task.update({ list: doneList });
```

## API

### `createTaskListClient(config)`

Factory function — returns a `TaskListClient` based on config type.

```typescript
// Trello (uses TRELLO_API_KEY / TRELLO_API_TOKEN env vars by default)
const client = createTaskListClient({ type: "trello" });

// Explicit credentials
const client = createTaskListClient({
  type: "trello",
  apiKey: "your-key",
  token: "your-token",
});
```

### `TaskListClient`

| Method | Returns | Description |
|--------|---------|-------------|
| `getBoards()` | `FullState` | All boards with lists, tasks, and labels |
| `getBoard(boardId)` | `BoardState` | Single board with lists, tasks, and labels |
| `getTask(taskId)` | `Task` | Single task by ID |

### `FullState`

| Method | Returns | Description |
|--------|---------|-------------|
| `findBoard(name)` | `BoardState` | Find by name (case-insensitive partial match) |
| `findTask(taskId)` | `Task` | Find task by ID across all boards |

### `BoardState`

| Property | Type | Description |
|----------|------|-------------|
| `board` | `Board` | Board info (id, name, url) |
| `lists` | `TaskList[]` | All lists on the board |
| `tasks` | `Task[]` | All tasks on the board |
| `labels` | `Label[]` | All labels on the board |

| Method | Returns | Description |
|--------|---------|-------------|
| `findList(name)` | `TaskList` | Find by name (case-insensitive partial match) |
| `findTask(taskId)` | `Task` | Find task by ID |
| `findLabel(name)` | `Label` | Find by name (case-insensitive partial match) |

### `TaskList`

| Method | Returns | Description |
|--------|---------|-------------|
| `createTask(name, options?)` | `Task` | Create a task in this list |

Options: `{ description?: string, labels?: Label[] }`

### `Task`

| Property | Type |
|----------|------|
| `id` | `string` |
| `name` | `string` |
| `description` | `string` |
| `listId` | `string` |
| `boardId` | `string` |
| `labels` | `Label[]` |
| `url` | `string` |

| Method | Returns | Description |
|--------|---------|-------------|
| `update(params)` | `Task` | Update and return new Task with server state |

Params: `{ name?: string, description?: string, list?: TaskList, labels?: Label[] }`

## Switching Providers

Change the config — zero client code changes:

```typescript
// Before
const client = createTaskListClient({ type: "trello" });

// After
const client = createTaskListClient({ type: "linear" });
```

## Supported Providers

- **Trello** — fully implemented
- **Linear** — coming soon
