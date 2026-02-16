import type { TaskContext, TaskData, UpdateTaskParams } from "./types.js";

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

  private readonly context: TaskContext;

  constructor(data: TaskData, context: TaskContext) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.status = context.resolveStatusName(data.statusId);
    this.projectId = data.projectId;
    this.labels = data.labels.map((l) => l.name);
    this.url = data.url;
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
      statusId: params.status
        ? this.context.resolveStatusId(params.status)
        : undefined,
      labelIds: params.labels
        ? params.labels.map((n) => this.context.resolveLabelId(n))
        : undefined,
    });
    return new Task(data, this.context);
  }
}
