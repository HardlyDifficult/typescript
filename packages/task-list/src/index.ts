// Types
export {
  type CreateTaskOptions,
  type UpdateTaskParams,
  type TrelloConfig,
  type LinearConfig,
  type TaskListConfig,
  type Provider,
  type MigrationResult,
  type MigratedTask,
} from "./types.js";

// Core classes
export { TaskListClient } from "./TaskListClient.js";
export { Task } from "./Task.js";
export { Project } from "./Project.js";
export { FullState } from "./FullState.js";

// Fluent builder
export { TaskList, ProjectRef, TaskRef } from "./TaskList.js";

// Platform implementations
export { TrelloTaskListClient } from "./trello";
export { LinearTaskListClient } from "./linear";

// Factory + fluent entry point
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
      throw new Error(
        `Unknown task list provider: ${(config as { type: string }).type}`
      );
  }
}

/**
 * Fluent entry point for task list operations.
 * Returns a synchronous TaskList builder — the chain is sync until a terminal async method.
 *
 * @example
 * ```typescript
 * // Explicit provider
 * createTaskList("linear").getProject("Bot").createTask({ name: "Fix bug", label: "Bug" })
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
  } else if (process.env.LINEAR_API_KEY) {
    config = { type: "linear", team: options?.team };
  } else if (process.env.TRELLO_API_KEY) {
    config = { type: "trello" };
  } else {
    throw new Error(
      "No task list provider configured. Set LINEAR_API_KEY or TRELLO_API_KEY."
    );
  }
  return new TaskList(createTaskListClient(config));
}
