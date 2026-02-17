import type { FullState } from "./FullState.js";
import type { Project } from "./Project.js";
import type { Task } from "./Task.js";
import type { TaskListClient } from "./TaskListClient.js";
import type { CreateTaskOptions, UpdateTaskParams } from "./types.js";

/**
 * Fluent entry point for task list operations.
 * Wraps a deferred client promise — the chain is synchronous until
 * a terminal async method (createTask, update, getProjects, etc.) is called.
 *
 * @example
 * ```typescript
 * createTaskList("linear").getProject("Bot").createTask({ name: "Fix bug", label: "Bug" })
 * ```
 */
export class TaskList {
  private readonly clientPromise: Promise<TaskListClient>;

  constructor(clientPromise: Promise<TaskListClient>) {
    this.clientPromise = clientPromise;
  }

  /** Get a deferred project reference by name. Chainable — no API call until a terminal method. */
  getProject(name: string): ProjectRef {
    return new ProjectRef(this.clientPromise, name);
  }

  /** Fetch all projects with tasks, statuses, and labels. */
  async getProjects(): Promise<FullState> {
    const client = await this.clientPromise;
    return client.getProjects();
  }

  /** Get a deferred task reference by ID. Chainable — no API call until a terminal method. */
  getTask(id: string): TaskRef {
    return new TaskRef(this.clientPromise, id);
  }
}

/**
 * Deferred project reference. Thenable — can be awaited to get the full Project,
 * or chained with .createTask() for a one-liner.
 */
export class ProjectRef implements PromiseLike<Project> {
  private readonly clientPromise: Promise<TaskListClient>;
  private readonly projectName: string;

  constructor(clientPromise: Promise<TaskListClient>, projectName: string) {
    this.clientPromise = clientPromise;
    this.projectName = projectName;
  }

  /** Create a task in this project. */
  async createTask(
    options: { name: string } & CreateTaskOptions
  ): Promise<Task> {
    const project = await this.resolve();
    return project.createTask(options.name, options);
  }

  then<T1 = Project, T2 = never>(
    onfulfilled?: ((value: Project) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): Promise<T1 | T2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private async resolve(): Promise<Project> {
    const client = await this.clientPromise;
    return client.findProject(this.projectName);
  }
}

/**
 * Deferred task reference. Thenable — can be awaited to get the full Task,
 * or chained with .update() for a one-liner.
 */
export class TaskRef implements PromiseLike<Task> {
  private readonly clientPromise: Promise<TaskListClient>;
  private readonly taskId: string;

  constructor(clientPromise: Promise<TaskListClient>, taskId: string) {
    this.clientPromise = clientPromise;
    this.taskId = taskId;
  }

  /** Update this task. Returns a new Task with the server state after update. */
  async update(params: UpdateTaskParams): Promise<Task> {
    const task = await this.resolve();
    return task.update(params);
  }

  then<T1 = Task, T2 = never>(
    onfulfilled?: ((value: Task) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): Promise<T1 | T2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private async resolve(): Promise<Task> {
    const client = await this.clientPromise;
    return client.getTask(this.taskId);
  }
}
