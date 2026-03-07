import { ProjectNotFoundError } from "./errors.js";
import type { Project } from "./Project.js";
import { findByCaseInsensitiveName } from "./resolvers.js";
import type { Task } from "./Task.js";
import type { TaskListClient } from "./TaskListClient.js";
import { TaskWatcher } from "./TaskWatcher.js";
import type {
  CreateTaskInput,
  Provider,
  TaskWatchHandle,
  TaskWatchOptions,
} from "./types.js";

/**
 *
 */
export class TaskList {
  readonly provider: Provider;

  constructor(private readonly client: TaskListClient) {
    this.provider = client.provider;
  }

  async projects(): Promise<Project[]> {
    return this.client.getProjects();
  }

  async project(name: string): Promise<Project> {
    const projects = await this.projects();
    const project = findByCaseInsensitiveName(projects, name);

    if (!project) {
      throw new ProjectNotFoundError(
        name,
        projects.map((entry) => entry.name)
      );
    }

    return project;
  }

  async projectById(id: string): Promise<Project> {
    return this.client.getProject(id);
  }

  async task(id: string): Promise<Task> {
    return this.client.getTask(id);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const project = await this.project(input.project);
    return project.createTask({
      title: input.title,
      description: input.description,
      labels: input.labels,
      status: input.status,
      priority: input.priority,
    });
  }

  watch(options: TaskWatchOptions): TaskWatchHandle {
    return new TaskWatcher(this, options).start();
  }
}
