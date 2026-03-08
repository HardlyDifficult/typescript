# @hardlydifficult/task-list

Opinionated task-list automation with a single async entrypoint. The default path is Linear. Trello is supported, but only when you ask for it explicitly.

## Installation

```bash
npm install @hardlydifficult/task-list
```

## Quick Start

```ts
import { createTaskList } from "@hardlydifficult/task-list";

const tasks = await createTaskList({ team: "Core" });

const bug = await tasks.createTask({
  project: "Bot",
  title: "Fix login",
  description: "Users cannot log in on mobile",
  labels: ["Bug"],
});

await bug.moveTo("In Progress");
await bug.tag("Escalated");
```

## Providers

### Linear

Linear is the default. If you omit `provider`, the package expects Linear credentials.

```ts
const tasks = await createTaskList({
  apiKey: process.env.LINEAR_API_KEY,
  team: "Core",
});
```

You can also pass `teamId` directly:

```ts
const tasks = await createTaskList({
  apiKey: process.env.LINEAR_API_KEY,
  teamId: "team-uuid",
});
```

### Trello

Trello must be selected explicitly.

```ts
const tasks = await createTaskList({
  provider: "trello",
  apiKey: process.env.TRELLO_API_KEY,
  token: process.env.TRELLO_API_TOKEN,
});
```

## Session API

```ts
const tasks = await createTaskList({ team: "Core" });

const projects = await tasks.projects();
const bot = await tasks.project("Bot");
const sameBot = await tasks.projectById(bot.id);
const issue = await tasks.task("ISS-123");
```

### Create a task by project name

```ts
await tasks.createTask({
  project: "Bot",
  title: "Ship changelog",
  status: "Todo",
  labels: ["Bug"],
  priority: "High",
});
```

### Watch a project

```ts
const watch = tasks.watch({
  project: "Bot",
  whenStatus: "Todo",
  moveTo: "In Progress",
  everyMs: 60_000,
  onTask: async (task) => {
    console.log("Picked up:", task.title);
  },
});

// Later
watch.stop();
```

## Project API

Projects are loaded snapshots with synchronous task filtering and explicit refresh.

```ts
const project = await tasks.project("Bot");

const openBugs = project.tasks({
  status: "Todo",
  labels: ["Bug"],
});

await project.createTask({
  title: "Tighten auth flow",
  description: "Handle expired sessions cleanly",
});

await project.refresh();
```

Available project methods:

- `project.tasks(filter?)`
- `project.findTask(id)`
- `project.findStatus(name)`
- `project.findLabel(name)`
- `project.createTask({ title, ... })`
- `project.updateTasks(filter, changes)`
- `project.createLabel(name, options?)`
- `project.deleteLabel(name)`
- `project.refresh()`

## Task API

Tasks are stateful. Mutating methods update the current instance and return it.

```ts
const task = await tasks.task("ISS-123");

await task.update({
  title: "Fix login on mobile",
  labels: ["Bug", "Escalated"],
});

await task.moveTo("Done");
await task.tag("Verified");
await task.untag("Bug");
await task.refresh();
```

Public fields:

- `id`
- `title`
- `description`
- `status`
- `projectId`
- `labels`
- `url`
- `priority`

## Matching Rules

- Project, label, and status lookups use exact case-insensitive matching.
- Partial matches are intentionally rejected.
- Lookup errors include the available names to make fixes obvious.

## Environment Variables

Optional environment variables:

```bash
LINEAR_API_KEY=...
TRELLO_API_KEY=...
TRELLO_API_TOKEN=...
```

## Errors

All custom errors extend `TaskListError` and include a machine-readable `code`.

- `PROVIDER_NOT_CONFIGURED`
- `PROJECT_NOT_FOUND`
- `TASK_NOT_FOUND`
- `STATUS_NOT_FOUND`
- `LABEL_NOT_FOUND`
- `TEAM_NOT_FOUND`
- `API_ERROR`
- `LINEAR_GRAPHQL_ERROR`
