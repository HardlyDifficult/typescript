// Types
export {
  type CreateTaskOptions,
  type UpdateTaskParams,
  type TrelloConfig,
  type LinearConfig,
  type TaskListConfig,
  type Provider,
  type Label,
  type Status,
  type Priority,
  type TaskFilter,
  type CreateLabelOptions,
} from "./types.js";
export { type BulkUpdateResult } from "./Project.js";

// Core classes
export { TaskListClient } from "./TaskListClient.js";
export { Task } from "./Task.js";
export { Project } from "./Project.js";

// Fluent builder
export { TaskList, ProjectRef, TaskRef } from "./TaskList.js";

// Watcher
export { TaskWatcher, type TaskWatcherOptions } from "./TaskWatcher.js";

// Platform implementations
export { TrelloTaskListClient } from "./trello";
export { LinearTaskListClient } from "./linear";

export {
  TaskListError,
  UnknownTaskListProviderError,
  TaskListProviderNotConfiguredError,
  ProjectNotFoundError,
  TaskNotFoundError,
  StatusNotFoundError,
  StatusIdNotFoundError,
  LabelNotFoundError,
  TeamNotFoundError,
  NoTeamsFoundError,
  MultipleTeamsFoundError,
  TeamNotResolvedError,
  TaskListApiError,
  LinearGraphQLError,
  InvalidPriorityError,
} from "./errors.js";

// Factory + fluent entry point
import {
  TaskListProviderNotConfiguredError,
  UnknownTaskListProviderError,
} from "./errors.js";
import { LinearTaskListClient } from "./linear";
import { TaskList } from "./TaskList.js";
import type { TaskListClient } from "./TaskListClient.js";
import { TrelloTaskListClient } from "./trello";
import type { TaskListConfig } from "./types.js";

/**
 * Create a raw task list client. Async because Linear needs team resolution.
 * For most use cases, prefer `createTaskList()` which provides a fluent API.
 */
export async function createTaskListClient(
  config: TaskListConfig
): Promise<TaskListClient> {
  switch (config.type) {
    case "trello":
      return new TrelloTaskListClient(config);
    case "linear": {
      const client = new LinearTaskListClient(config);
      await client.resolveTeam();
      return client;
    }
    default:
      throw new UnknownTaskListProviderError((config as { type: string }).type);
  }
}

/**
 * Fluent entry point for task list operations.
 * Returns a synchronous TaskList builder — the chain is sync until a terminal async method.
 *
 * @example
 * ```typescript
 * // Explicit provider
 * createTaskList("linear").getProject("Bot").createTask({ name: "Fix bug", labels: ["Bug"] })
 *
 * // With team name
 * createTaskList("linear", { team: "MyTeam" }).getProject("Bot").createTask({ name: "Fix bug" })
 *
 * // Auto-detect from env vars (LINEAR_API_KEY or TRELLO_API_KEY)
 * createTaskList().getProject("Bot").createTask({ name: "Fix bug" })
 * ```
 */
export function createTaskList(
  type?: "linear" | "trello",
  options?: { team?: string }
): TaskList {
  let config: TaskListConfig;
  if (type === "linear") {
    config = { type: "linear", team: options?.team };
  } else if (type === "trello") {
    config = { type: "trello" };
  } else if (process.env.LINEAR_API_KEY !== undefined) {
    config = { type: "linear", team: options?.team };
  } else if (process.env.TRELLO_API_KEY !== undefined) {
    config = { type: "trello" };
  } else {
    throw new TaskListProviderNotConfiguredError();
  }
  return new TaskList(createTaskListClient(config));
}
