import { Task } from "./Task.js";
import type { CreateTaskOptions, TaskContext } from "./types.js";

/**
 * A project (Trello Board, Linear Project) with task creation capability.
 * Statuses and labels are exposed as human-readable name arrays.
 */
export class Project {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly statuses: readonly string[];
  readonly labels: readonly string[];
  readonly tasks: readonly Task[];

  private readonly context: TaskContext;
  private readonly defaultStatusId: string;

  constructor(
    info: { id: string; name: string; url: string },
    statusEntries: readonly { id: string; name: string }[],
    tasks: readonly Task[],
    labelEntries: readonly { id: string; name: string }[],
    context: TaskContext
  ) {
    this.id = info.id;
    this.name = info.name;
    this.url = info.url;
    this.statuses = statusEntries.map((s) => s.name);
    this.labels = labelEntries.map((l) => l.name);
    this.tasks = tasks;
    this.context = context;
    this.defaultStatusId = statusEntries[0]?.id ?? "";
  }

  /**
   * Create a new task in this project.
   * @param name - Task name/title
   * @param options - Optional description, labels (by name), and status (by name)
   * @returns The created Task
   */
  async createTask(name: string, options?: CreateTaskOptions): Promise<Task> {
    const statusId = options?.status
      ? this.context.resolveStatusId(options.status)
      : this.defaultStatusId;

    const labelIds = options?.labels
      ? options.labels.map((n) => this.context.resolveLabelId(n))
      : undefined;

    const data = await this.context.createTask({
      statusId,
      projectId: this.id,
      name,
      description: options?.description,
      labelIds,
    });
    return new Task(data, this.context);
  }

  /**
   * Find a task by ID
   * @param taskId - Task ID to find
   * @returns The matching Task
   * @throws Error if no task matches
   */
  findTask(taskId: string): Task {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(
        `Task "${taskId}" not found in project "${this.name}"`
      );
    }
    return task;
  }
}
