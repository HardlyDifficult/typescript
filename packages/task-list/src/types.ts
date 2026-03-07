import type { Project } from "./Project.js";
import type { Task } from "./Task.js";

export interface TrelloConfig {
  provider: "trello";
  apiKey?: string;
  token?: string;
}

export interface LinearConfig {
  provider?: "linear";
  apiKey?: string;
  teamId?: string;
  team?: string;
}

export type TaskListConfig = LinearConfig | TrelloConfig;

export type Provider = "trello" | "linear";

export interface Label {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface Status {
  readonly id: string;
  readonly name: string;
}

export type Priority = "None" | "Urgent" | "High" | "Medium" | "Low";

export interface TaskFilter {
  readonly label?: string;
  readonly labels?: readonly string[];
  readonly status?: string;
  readonly priority?: Priority;
}

export interface CreateLabelOptions {
  readonly color?: string;
}

export interface CreateProjectTaskInput {
  readonly title: string;
  readonly description?: string;
  readonly labels?: readonly string[];
  readonly status?: string;
  readonly priority?: Priority;
}

export interface CreateTaskInput extends CreateProjectTaskInput {
  readonly project: string;
}

export interface UpdateTaskInput {
  readonly title?: string;
  readonly description?: string;
  readonly status?: string;
  readonly labels?: readonly string[];
  readonly priority?: Priority;
}

export interface TaskWatchOptions {
  readonly project: string;
  readonly whenStatus: string;
  readonly moveTo: string;
  readonly everyMs?: number;
  readonly onTask: (task: Task, project: Project) => void | Promise<void>;
  readonly onError?: (error: Error) => void;
}

export interface TaskWatchHandle {
  stop(): void;
  poll(): Promise<void>;
}

export interface TaskData {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly statusId: string;
  readonly projectId: string;
  readonly labels: readonly Label[];
  readonly url: string;
  readonly priority?: number;
}

export interface ProjectSnapshot {
  readonly info: {
    readonly id: string;
    readonly name: string;
    readonly url: string;
  };
  readonly statuses: readonly Status[];
  readonly labels: readonly Label[];
  readonly tasks: readonly TaskData[];
  readonly context: TaskContext;
}

export interface TaskSnapshot {
  readonly task: TaskData;
  readonly context: TaskContext;
}

export interface TaskContext {
  createTask(params: {
    projectId: string;
    title: string;
    statusId: string;
    description?: string;
    labelIds?: readonly string[];
    priority?: number;
  }): Promise<TaskSnapshot>;

  updateTask(params: {
    taskId: string;
    title?: string;
    description?: string;
    statusId?: string;
    labelIds?: readonly string[];
    priority?: number;
  }): Promise<TaskSnapshot>;

  fetchTask(taskId: string): Promise<TaskSnapshot>;
  fetchProject(projectId: string): Promise<ProjectSnapshot>;

  createLabel(name: string, color?: string): Promise<Label>;
  deleteLabel(labelId: string): Promise<void>;

  resolveStatusId(name: string): string;
  resolveStatusName(id: string): string;
  resolveLabelId(name: string): string;
  resolvePriority?(name: string): number;

  readonly labels: readonly Label[];
  readonly statuses: readonly Status[];
}
