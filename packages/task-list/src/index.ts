// Types
export {
  type Board,
  type Label,
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
export { TaskList } from "./TaskList.js";
export { BoardState } from "./BoardState.js";
export { FullState } from "./FullState.js";

// Platform implementations
export { TrelloTaskListClient } from "./trello";

// Factory
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
 * // Usage
 * const state = await client.getBoards();
 * const list = state.findBoard("My Board").findList("To Do");
 * const task = await list.createTask("New task");
 * await task.update({ name: "Updated task" });
 * ```
 */
export function createTaskListClient(config: TaskListConfig): TaskListClient {
  switch (config.type) {
    case "trello":
      return new TrelloTaskListClient(config);
    case "linear":
      throw new Error("Linear provider not yet implemented");
    default:
      throw new Error(
        `Unknown task list provider: ${(config as { type: string }).type}`
      );
  }
}
