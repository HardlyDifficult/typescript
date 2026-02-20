import { Task } from "./Task.js";
import type {
  CreateLabelOptions,
  CreateTaskOptions,
  Label,
  Status,
  TaskContext,
  TaskFilter,
  UpdateTaskParams,
} from "./types.js";

/**
 * Result of a bulk update operation
 */
export interface BulkUpdateResult {
  readonly updated: readonly Task[];
  readonly count: number;
}

/**
 * A project (Trello Board, Linear Project) with task creation capability.
 * Statuses and labels are exposed as rich objects for enumeration and CRUD.
 * Tasks are eagerly loaded and can be filtered in memory via getTasks().
 */
export class Project {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly statuses: readonly Status[];
  readonly labels: readonly Label[];
  readonly tasks: readonly Task[];

  private readonly context: TaskContext;
  private readonly defaultStatusId: string;

  constructor(
    info: { id: string; name: string; url: string },
    statusEntries: readonly { id: string; name: string }[],
    tasks: readonly Task[],
    labelEntries: readonly { id: string; name: string; color: string }[],
    context: TaskContext
  ) {
    this.id = info.id;
    this.name = info.name;
    this.url = info.url;
    this.statuses = statusEntries.map((s) => ({ id: s.id, name: s.name }));
    this.labels = labelEntries.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    }));
    this.tasks = tasks;
    this.context = context;
    this.defaultStatusId = statusEntries[0]?.id ?? "";
  }

  /**
   * Create a new task in this project.
   * @param name - Task name/title
   * @param options - Optional description, labels, status, and priority
   * @returns The created Task
   */
  async createTask(name: string, options?: CreateTaskOptions): Promise<Task> {
    const statusId =
      options?.status !== undefined && options.status !== ""
        ? this.context.resolveStatusId(options.status)
        : this.defaultStatusId;

    const labelIds = options?.labels
      ? options.labels.map((n) => this.context.resolveLabelId(n))
      : undefined;

    const priority =
      options?.priority !== undefined && this.context.resolvePriority
        ? this.context.resolvePriority(options.priority)
        : undefined;

    const data = await this.context.createTask({
      statusId,
      projectId: this.id,
      name,
      description: options?.description,
      labelIds,
      priority,
    });
    return new Task(data, this.context);
  }

  /**
   * Find a task by ID within the loaded tasks.
   * @param taskId - Task ID to find
   * @returns The matching Task
   * @throws Error if no task matches
   */
  findTask(taskId: string): Task {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" not found in project "${this.name}"`);
    }
    return task;
  }

  /**
   * Filter the loaded tasks by criteria.
   * All provided filter fields must match (AND logic).
   * @param filter - Optional filter criteria. If omitted, returns all tasks.
   */
  getTasks(filter?: TaskFilter): readonly Task[] {
    if (!filter) {
      return this.tasks;
    }

    return this.tasks.filter((task) => {
      if (filter.status !== undefined) {
        if (!task.status.toLowerCase().includes(filter.status.toLowerCase())) {
          return false;
        }
      }
      if (filter.label !== undefined) {
        const filterLabel = filter.label;
        if (
          !task.labels.some((l) =>
            l.toLowerCase().includes(filterLabel.toLowerCase())
          )
        ) {
          return false;
        }
      }
      if (filter.labels !== undefined) {
        for (const required of filter.labels) {
          if (
            !task.labels.some((l) => l.toLowerCase() === required.toLowerCase())
          ) {
            return false;
          }
        }
      }
      if (filter.priority !== undefined) {
        if (task.priority !== filter.priority) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Update all tasks matching the filter.
   * @param filter - Criteria to select tasks
   * @param changes - Fields to update on each matching task
   * @returns The updated tasks and count
   */
  async updateTasks(
    filter: TaskFilter,
    changes: UpdateTaskParams
  ): Promise<BulkUpdateResult> {
    const matching = this.getTasks(filter);
    const updated: Task[] = [];
    for (const task of matching) {
      updated.push(await task.update(changes));
    }
    return { updated, count: updated.length };
  }

  /**
   * Create a new label for this project/team.
   * Linear: creates a team-level label. Trello: creates a board-level label.
   */
  async createLabel(
    name: string,
    options?: CreateLabelOptions
  ): Promise<Label> {
    return this.context.createLabel(name, options?.color);
  }

  /**
   * Delete a label by name.
   * @throws Error if the label is not found
   */
  async deleteLabel(name: string): Promise<void> {
    const label = this.findLabel(name);
    return this.context.deleteLabel(label.id);
  }

  /**
   * Find a status by name (case-insensitive partial match).
   * @throws Error if no status matches
   */
  findStatus(name: string): Status {
    const lower = name.toLowerCase();
    const status = this.statuses.find((s) =>
      s.name.toLowerCase().includes(lower)
    );
    if (!status) {
      throw new Error(`Status "${name}" not found in project "${this.name}"`);
    }
    return status;
  }

  /**
   * Find a label by name (case-insensitive partial match).
   * @throws Error if no label matches
   */
  findLabel(name: string): Label {
    const lower = name.toLowerCase();
    const label = this.labels.find((l) => l.name.toLowerCase().includes(lower));
    if (!label) {
      throw new Error(`Label "${name}" not found in project "${this.name}"`);
    }
    return label;
  }
}
