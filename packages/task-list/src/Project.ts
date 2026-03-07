import {
  LabelNotFoundError,
  StatusNotFoundError,
  TaskNotFoundError,
} from "./errors.js";
import { findByCaseInsensitiveName, matchesCaseInsensitive } from "./resolvers.js";
import { Task } from "./Task.js";
import type {
  CreateLabelOptions,
  CreateProjectTaskInput,
  Label,
  ProjectSnapshot,
  Status,
  TaskContext,
  TaskFilter,
} from "./types.js";

export interface BulkUpdateResult {
  readonly updated: readonly Task[];
  readonly count: number;
}

export class Project {
  id: string;
  name: string;
  url: string;
  statuses: readonly Status[];
  labels: readonly Label[];

  private context: TaskContext;
  private taskEntries: Task[];

  constructor(snapshot: ProjectSnapshot) {
    this.id = snapshot.info.id;
    this.name = snapshot.info.name;
    this.url = snapshot.info.url;
    this.statuses = snapshot.statuses.map((status) => ({ ...status }));
    this.labels = snapshot.labels.map((label) => ({ ...label }));
    this.context = snapshot.context;
    this.taskEntries = snapshot.tasks.map(
      (task) => new Task({ task, context: snapshot.context })
    );
  }

  tasks(filter?: TaskFilter): readonly Task[] {
    if (!filter) {
      return [...this.taskEntries];
    }

    return this.taskEntries.filter((task) => {
      if (
        filter.status !== undefined &&
        !matchesCaseInsensitive(task.status, filter.status)
      ) {
        return false;
      }

      if (filter.label !== undefined) {
        const filterLabel = filter.label;
        const hasLabel = task.labels.some((label) =>
          matchesCaseInsensitive(label, filterLabel)
        );
        if (!hasLabel) {
          return false;
        }
      }

      if (filter.labels !== undefined) {
        for (const requiredLabel of filter.labels) {
          const hasLabel = task.labels.some((label) =>
            matchesCaseInsensitive(label, requiredLabel)
          );
          if (!hasLabel) {
            return false;
          }
        }
      }

      if (
        filter.priority !== undefined &&
        task.priority !== filter.priority
      ) {
        return false;
      }

      return true;
    });
  }

  async createTask(input: CreateProjectTaskInput): Promise<Task> {
    const statusId =
      input.status !== undefined && input.status !== ""
        ? this.context.resolveStatusId(input.status)
        : (this.statuses[0]?.id ?? "");

    const labelIds = input.labels?.map((name) => this.context.resolveLabelId(name));
    const priority =
      input.priority !== undefined && this.context.resolvePriority
        ? this.context.resolvePriority(input.priority)
        : undefined;

    const snapshot = await this.context.createTask({
      projectId: this.id,
      title: input.title,
      statusId,
      description: input.description,
      labelIds,
      priority,
    });

    const task = new Task(snapshot);
    this.taskEntries = [...this.taskEntries, task];
    return task;
  }

  findTask(taskId: string): Task {
    const task = this.taskEntries.find((entry) => entry.id === taskId);
    if (!task) {
      throw new TaskNotFoundError(
        taskId,
        this.name,
        this.taskEntries.map((entry) => entry.id)
      );
    }
    return task;
  }

  async updateTasks(
    filter: TaskFilter,
    changes: Parameters<Task["update"]>[0]
  ): Promise<BulkUpdateResult> {
    const matchingTasks = this.tasks(filter);
    const updated: Task[] = [];

    for (const task of matchingTasks) {
      updated.push(await task.update(changes));
    }

    return { updated, count: updated.length };
  }

  async createLabel(
    name: string,
    options?: CreateLabelOptions
  ): Promise<Label> {
    const label = await this.context.createLabel(name, options?.color);
    await this.refresh();
    return label;
  }

  async deleteLabel(name: string): Promise<void> {
    const label = this.findLabel(name);
    await this.context.deleteLabel(label.id);
    await this.refresh();
  }

  findStatus(name: string): Status {
    const status = findByCaseInsensitiveName(this.statuses, name);
    if (!status) {
      throw new StatusNotFoundError(
        name,
        this.name,
        this.statuses.map((entry) => entry.name)
      );
    }
    return status;
  }

  findLabel(name: string): Label {
    const label = findByCaseInsensitiveName(this.labels, name);
    if (!label) {
      throw new LabelNotFoundError(
        name,
        this.name,
        this.labels.map((entry) => entry.name)
      );
    }
    return label;
  }

  async refresh(): Promise<this> {
    const snapshot = await this.context.fetchProject(this.id);
    this.applySnapshot(snapshot);
    return this;
  }

  private applySnapshot(snapshot: ProjectSnapshot): void {
    this.context = snapshot.context;
    this.id = snapshot.info.id;
    this.name = snapshot.info.name;
    this.url = snapshot.info.url;
    this.statuses = snapshot.statuses.map((status) => ({ ...status }));
    this.labels = snapshot.labels.map((label) => ({ ...label }));
    this.taskEntries = snapshot.tasks.map(
      (task) => new Task({ task, context: snapshot.context })
    );
  }
}
