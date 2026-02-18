import type {
  Priority,
  TaskContext,
  TaskData,
  UpdateTaskParams,
} from "./types.js";

const PRIORITY_NUMBER_TO_NAME: Record<number, Priority> = {
  0: "None",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

/**
 * A task (Trello Card, Linear Issue) with update capability.
 * Status and labels are exposed as human-readable names.
 */
export class Task {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly projectId: string;
  readonly labels: readonly string[];
  readonly url: string;
  readonly priority: Priority | undefined;

  /** @internal */
  readonly context: TaskContext;

  constructor(data: TaskData, context: TaskContext) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.status = context.resolveStatusName(data.statusId);
    this.projectId = data.projectId;
    this.labels = data.labels.map((l) => l.name);
    this.url = data.url;
    this.priority =
      data.priority !== undefined
        ? PRIORITY_NUMBER_TO_NAME[data.priority]
        : undefined;
    this.context = context;
  }

  /**
   * Update this task. Returns a new Task with the updated data.
   * @param params - Fields to update. Status and labels are referenced by name.
   * @returns New Task reflecting the server state after update
   */
  async update(params: UpdateTaskParams): Promise<Task> {
    const data = await this.context.updateTask({
      taskId: this.id,
      name: params.name,
      description: params.description,
      statusId:
        params.status !== undefined && params.status !== ""
          ? this.context.resolveStatusId(params.status)
          : undefined,
      labelIds: params.labels
        ? params.labels.map((n) => this.context.resolveLabelId(n))
        : undefined,
      priority:
        params.priority !== undefined && this.context.resolvePriority
          ? this.context.resolvePriority(params.priority)
          : undefined,
    });
    return new Task(data, this.context);
  }

  /**
   * Add a label to this task by name.
   * @returns New Task with the label added
   */
  async addLabel(name: string): Promise<Task> {
    const labelId = this.context.resolveLabelId(name);
    const data = await this.context.addTaskLabel(this.id, labelId);
    return new Task(data, this.context);
  }

  /**
   * Remove a label from this task by name.
   * @returns New Task with the label removed
   */
  async removeLabel(name: string): Promise<Task> {
    const labelId = this.context.resolveLabelId(name);
    const data = await this.context.removeTaskLabel(this.id, labelId);
    return new Task(data, this.context);
  }

  /**
   * Set the task's status by name.
   * @returns New Task with the updated status
   */
  async setStatus(name: string): Promise<Task> {
    return this.update({ status: name });
  }
}
