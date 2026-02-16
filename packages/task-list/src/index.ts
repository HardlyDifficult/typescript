// Types
export {
  type CreateTaskOptions,
  type UpdateTaskParams,
  type TrelloConfig,
  type LinearConfig,
  type TaskListConfig,
  type Provider,
} from "./types.js";

// Core classes
export { TaskListClient } from "./TaskListClient.js";
export { Task } from "./Task.js";
export { Project } from "./Project.js";
export { FullState } from "./FullState.js";

// Platform implementations
export { TrelloTaskListClient } from "./trello";
export { LinearTaskListClient } from "./linear";

// Factory
import { LinearTaskListClient } from "./linear";
import type { TaskListClient } from "./TaskListClient.js";
import { TrelloTaskListClient } from "./trello";
import type { TaskListConfig } from "./types.js";

/**
 * Factory function to create a task list client based on config type
 *
 * @example
 * ```typescript
 * // Trello (uses env vars by default)
 * const client = createTaskListClient({ type: 'trello' });
 *
 * // Linear (team-scoped)
 * const client = createTaskListClient({ type: 'linear', teamId: 'team-uuid' });
 *
 * // Usage
 * const project = await client.findProject("My Project");
 * const task = await project.createTask("New task");
 * await task.update({ status: "done" });
 * ```
 */
export function createTaskListClient(config: TaskListConfig): TaskListClient {
  switch (config.type) {
    case "trello":
      return new TrelloTaskListClient(config);
    case "linear":
      return new LinearTaskListClient(config);
    default:
      throw new Error(
        `Unknown task list provider: ${(config as { type: string }).type}`
      );
  }
}
