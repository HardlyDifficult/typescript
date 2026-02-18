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
  teamId?: string; // Linear team UUID — auto-detected for single-team workspaces
  team?: string; // Friendly team name — resolved to teamId via API
}

export type TaskListConfig = TrelloConfig | LinearConfig;

/**
 * Provider identifier
 */
export type Provider = "trello" | "linear";

/**
 * A label with identity and color
 */
export interface Label {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

/**
 * A workflow status with identity
 */
export interface Status {
  readonly id: string;
  readonly name: string;
}

/**
 * Priority levels
 */
export type Priority = "None" | "Urgent" | "High" | "Medium" | "Low";

/**
 * Filter criteria for querying tasks
 */
export interface TaskFilter {
  readonly label?: string;
  readonly labels?: readonly string[];
  readonly status?: string;
  readonly priority?: Priority;
}

/**
 * Options for creating a label
 */
export interface CreateLabelOptions {
  readonly color?: string;
}

/**
 * Options for creating a task (passed to Project.createTask)
 */
export interface CreateTaskOptions {
  readonly description?: string | undefined;
  readonly labels?: readonly string[] | undefined;
  readonly status?: string | undefined;
  readonly priority?: Priority | undefined;
}

/**
 * Parameters for updating a task (passed to Task.update)
 */
export interface UpdateTaskParams {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly status?: string | undefined;
  readonly labels?: readonly string[] | undefined;
  readonly priority?: Priority | undefined;
}

/**
 * Internal raw task data returned by provider operations
 * @internal
 */
export interface TaskData {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly statusId: string;
  readonly projectId: string;
  readonly labels: readonly {
    readonly id: string;
    readonly name: string;
    readonly color: string;
  }[];
  readonly url: string;
  readonly priority?: number;
}

/**
 * Internal interface for provider-specific task operations and name resolution
 * @internal
 */
export interface TaskContext {
  createTask(params: {
    statusId: string;
    projectId: string;
    name: string;
    description?: string;
    labelIds?: readonly string[];
    priority?: number;
  }): Promise<TaskData>;

  updateTask(params: {
    taskId: string;
    name?: string;
    description?: string;
    statusId?: string;
    labelIds?: readonly string[];
    priority?: number;
  }): Promise<TaskData>;

  addTaskLabel(taskId: string, labelId: string): Promise<TaskData>;
  removeTaskLabel(taskId: string, labelId: string): Promise<TaskData>;

  createLabel(
    name: string,
    color?: string
  ): Promise<{ id: string; name: string; color: string }>;
  deleteLabel(labelId: string): Promise<void>;

  resolveStatusId(name: string): string;
  resolveStatusName(id: string): string;
  resolveLabelId(name: string): string;
  resolvePriority?(name: string): number;

  readonly labels: readonly {
    readonly id: string;
    readonly name: string;
    readonly color: string;
  }[];
  readonly statuses: readonly { readonly id: string; readonly name: string }[];
}
