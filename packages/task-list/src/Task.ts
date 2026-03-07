import { matchesCaseInsensitive } from "./resolvers.js";
import type { Priority, TaskContext, TaskSnapshot, UpdateTaskInput } from "./types.js";

const PRIORITY_NUMBER_TO_NAME: Record<number, Priority> = {
  0: "None",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

export class Task {
  id: string;
  title: string;
  description: string;
  status: string;
  projectId: string;
  labels: string[];
  url: string;
  priority: Priority | undefined;

  private context: TaskContext;

  constructor(snapshot: TaskSnapshot) {
    this.id = snapshot.task.id;
    this.title = snapshot.task.title;
    this.description = snapshot.task.description;
    this.status = snapshot.context.resolveStatusName(snapshot.task.statusId);
    this.projectId = snapshot.task.projectId;
    this.labels = snapshot.task.labels.map((label) => label.name);
    this.url = snapshot.task.url;
    this.priority =
      snapshot.task.priority !== undefined
        ? PRIORITY_NUMBER_TO_NAME[snapshot.task.priority]
        : undefined;
    this.context = snapshot.context;
  }

  async update(params: UpdateTaskInput): Promise<this> {
    const snapshot = await this.context.updateTask({
      taskId: this.id,
      title: params.title,
      description: params.description,
      statusId:
        params.status !== undefined && params.status !== ""
          ? this.context.resolveStatusId(params.status)
          : undefined,
      labelIds: params.labels?.map((name) => this.context.resolveLabelId(name)),
      priority:
        params.priority !== undefined && this.context.resolvePriority
          ? this.context.resolvePriority(params.priority)
          : undefined,
    });
    this.applySnapshot(snapshot);
    return this;
  }

  async moveTo(status: string): Promise<this> {
    return this.update({ status });
  }

  async tag(...labels: readonly string[]): Promise<this> {
    const nextLabels = [...this.labels];

    for (const labelName of labels) {
      const labelId = this.context.resolveLabelId(labelName);
      const canonicalLabel =
        this.context.labels.find((label) => label.id === labelId)?.name ??
        labelName;

      if (
        !nextLabels.some((currentLabel) =>
          matchesCaseInsensitive(currentLabel, canonicalLabel)
        )
      ) {
        nextLabels.push(canonicalLabel);
      }
    }

    return this.update({ labels: nextLabels });
  }

  async untag(...labels: readonly string[]): Promise<this> {
    const toRemove = new Set(
      labels.map((labelName) => this.context.resolveLabelId(labelName))
    );
    const nextLabels = this.context.labels
      .filter((label) => !toRemove.has(label.id))
      .map((label) => label.name)
      .filter((labelName) =>
        this.labels.some((currentLabel) =>
          matchesCaseInsensitive(currentLabel, labelName)
        )
      );

    return this.update({ labels: nextLabels });
  }

  async refresh(): Promise<this> {
    const snapshot = await this.context.fetchTask(this.id);
    this.applySnapshot(snapshot);
    return this;
  }

  private applySnapshot(snapshot: TaskSnapshot): void {
    this.context = snapshot.context;
    this.id = snapshot.task.id;
    this.title = snapshot.task.title;
    this.description = snapshot.task.description;
    this.status = snapshot.context.resolveStatusName(snapshot.task.statusId);
    this.projectId = snapshot.task.projectId;
    this.labels = snapshot.task.labels.map((label) => label.name);
    this.url = snapshot.task.url;
    this.priority =
      snapshot.task.priority !== undefined
        ? PRIORITY_NUMBER_TO_NAME[snapshot.task.priority]
        : undefined;
  }
}
