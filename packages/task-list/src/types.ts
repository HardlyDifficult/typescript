/**
 * Configuration for Trello provider
 */
export interface TrelloConfig {
  type: "trello";
  apiKey?: string; // defaults to process.env.TRELLO_API_KEY
  token?: string; // defaults to process.env.TRELLO_API_TOKEN
}

/**
 * Configuration for Linear provider
 */
export interface LinearConfig {
  type: "linear";
  apiKey?: string; // defaults to process.env.LINEAR_API_KEY
}

export type TaskListConfig = TrelloConfig | LinearConfig;

/**
 * Provider identifier
 */
export type Provider = "trello" | "linear";

/**
 * A project board (Trello Board, Linear Project)
 */
export interface Board {
  readonly id: string;
  readonly name: string;
  readonly url: string;
}

/**
 * A label/tag on a task
 */
export interface Label {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

/**
 * Options for creating a task (passed to TaskList.createTask)
 */
export interface CreateTaskOptions {
  readonly description?: string | undefined;
  readonly labels?: readonly Label[] | undefined;
}

/**
 * Parameters for updating a task (passed to Task.update)
 */
export interface UpdateTaskParams {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly list?: { readonly id: string } | undefined;
  readonly labels?: readonly Label[] | undefined;
}

/**
 * Internal raw task data returned by provider operations
 * @internal
 */
export interface TaskData {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly listId: string;
  readonly boardId: string;
  readonly labels: readonly Label[];
  readonly url: string;
}

/**
 * Internal raw task list data returned by provider operations
 * @internal
 */
export interface TaskListData {
  readonly id: string;
  readonly name: string;
  readonly boardId: string;
}

/**
 * Internal interface for provider-specific task operations
 * @internal
 */
export interface TaskOperations {
  createTask(
    listId: string,
    name: string,
    description?: string,
    labelIds?: readonly string[]
  ): Promise<TaskData>;

  updateTask(
    taskId: string,
    name?: string,
    description?: string,
    listId?: string,
    labelIds?: readonly string[]
  ): Promise<TaskData>;
}
