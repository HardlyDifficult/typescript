import type { BulkUpdateResult, Project } from "./Project.js";
import type { Task } from "./Task.js";
import type { TaskListClient } from "./TaskListClient.js";
import type {
  CreateLabelOptions,
  CreateTaskOptions,
  Label,
  TaskFilter,
  UpdateTaskParams,
} from "./types.js";

/**
 * Fluent entry point for task list operations.
 * Wraps a deferred client promise — the chain is synchronous until
 * a terminal async method (createTask, update, getProjects, etc.) is called.
 *
 * @example
 * ```typescript
 * createTaskList("linear").getProject("Bot").createTask({ name: "Fix bug", labels: ["Bug"] })
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
  async getProjects(): Promise<Project[]> {
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

  /** Filter tasks in this project. */
  async getTasks(filter?: TaskFilter): Promise<readonly Task[]> {
    const project = await this.resolve();
    return project.getTasks(filter);
  }

  /** Bulk update tasks matching the filter. */
  async updateTasks(
    filter: TaskFilter,
    changes: UpdateTaskParams
  ): Promise<BulkUpdateResult> {
    const project = await this.resolve();
    return project.updateTasks(filter, changes);
  }

  /** Create a label on this project. */
  async createLabel(
    name: string,
    options?: CreateLabelOptions
  ): Promise<Label> {
    const project = await this.resolve();
    return project.createLabel(name, options);
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

  /** Add a label to this task. */
  async addLabel(name: string): Promise<Task> {
    const task = await this.resolve();
    return task.addLabel(name);
  }

  /** Remove a label from this task. */
  async removeLabel(name: string): Promise<Task> {
    const task = await this.resolve();
    return task.removeLabel(name);
  }

  /** Set status on this task. */
  async setStatus(name: string): Promise<Task> {
    const task = await this.resolve();
    return task.setStatus(name);
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
