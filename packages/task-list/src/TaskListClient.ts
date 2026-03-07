import type { Project } from "./Project.js";
import type { Task } from "./Task.js";
import type { Provider, TaskListConfig } from "./types.js";

export abstract class TaskListClient {
  abstract readonly provider: Provider;

  constructor(protected readonly config: TaskListConfig) {}

  async initialize(): Promise<void> {}

  abstract getProjects(): Promise<Project[]>;

  abstract getProject(projectId: string): Promise<Project>;

  abstract getTask(taskId: string): Promise<Task>;
}
