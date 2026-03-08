export {
  type CreateLabelOptions,
  type CreateProjectTaskInput,
  type CreateTaskInput,
  type LinearConfig,
  type TrelloConfig,
  type TaskFilter,
  type TaskListConfig,
  type TaskWatchHandle,
  type TaskWatchOptions,
  type UpdateTaskInput,
  type Label,
  type Priority,
  type Provider,
  type Status,
} from "./types.js";
export { type BulkUpdateResult } from "./Project.js";

export { Task } from "./Task.js";
export { Project } from "./Project.js";
export { TaskList } from "./TaskList.js";

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
  TaskListApiError,
  LinearGraphQLError,
  InvalidPriorityError,
} from "./errors.js";

import { UnknownTaskListProviderError } from "./errors.js";
import { LinearTaskListClient } from "./linear";
import { TaskList } from "./TaskList.js";
import type { TaskListClient } from "./TaskListClient.js";
import { TrelloTaskListClient } from "./trello";
import type { TaskListConfig } from "./types.js";

function normalizeConfig(config?: TaskListConfig): TaskListConfig {
  if (config === undefined) {
    return { provider: "linear" };
  }

  if (config.provider === undefined || config.provider === "linear") {
    return {
      provider: "linear",
      apiKey: config.apiKey,
      team: config.team,
      teamId: config.teamId,
    };
  }

  const { provider } = config as { provider?: unknown };
  if (provider === "trello") {
    return config;
  }

  throw new UnknownTaskListProviderError(String(provider));
}

function createClient(config: TaskListConfig): TaskListClient {
  if (config.provider === "trello") {
    return new TrelloTaskListClient(config);
  }

  if (config.provider === "linear") {
    return new LinearTaskListClient(config);
  }

  throw new UnknownTaskListProviderError(
    String((config as { provider?: unknown }).provider)
  );
}

/** Creates and initializes a TaskList instance for the configured provider. */
export async function createTaskList(
  config?: TaskListConfig
): Promise<TaskList> {
  const normalizedConfig = normalizeConfig(config);
  const client = createClient(normalizedConfig);
  await client.initialize();
  return new TaskList(client);
}
