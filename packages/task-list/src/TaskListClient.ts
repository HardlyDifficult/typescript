import type { Project } from "./Project.js";
import type { Task } from "./Task.js";
import type { Provider, TaskListConfig } from "./types.js";

/** Base client contract implemented by provider-specific task list clients. */
export abstract class TaskListClient {
  abstract readonly provider: Provider;

  constructor(protected readonly config: TaskListConfig) {}

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  abstract getProjects(): Promise<Project[]>;

  abstract getProject(projectId: string): Promise<Project>;

  abstract getTask(taskId: string): Promise<Task>;
}
