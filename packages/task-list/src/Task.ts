import type { TaskContext, TaskData, UpdateTaskParams } from "./types.js";

const PRIORITY_NUMBER_TO_NAME: Record<number, string> = {
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
  readonly priority: string | undefined;

  private readonly context: TaskContext;

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
    const allLabels = mergeLabels(params.labels, params.label);

    const data = await this.context.updateTask({
      taskId: this.id,
      name: params.name,
      description: params.description,
      statusId:
        params.status !== undefined && params.status !== ""
          ? this.context.resolveStatusId(params.status)
          : undefined,
      labelIds: allLabels
        ? allLabels.map((n) => this.context.resolveLabelId(n))
        : undefined,
      priority:
        params.priority !== undefined && this.context.resolvePriority
          ? this.context.resolvePriority(params.priority)
          : undefined,
    });
    return new Task(data, this.context);
  }
}

/** Merge singular `label` into `labels` array */
export function mergeLabels(
  labels?: readonly string[],
  label?: string
): readonly string[] | undefined {
  if (label !== undefined) {
    return labels ? [...labels, label] : [label];
  }
  return labels;
}
