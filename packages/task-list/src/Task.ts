import type {
  Label,
  TaskData,
  TaskOperations,
  UpdateTaskParams,
} from "./types.js";

/**
 * A task (Trello Card, Linear Issue) with update capability
 */
export class Task {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly listId: string;
  readonly boardId: string;
  readonly labels: readonly Label[];
  readonly url: string;

  private readonly operations: TaskOperations;

  constructor(data: TaskData, operations: TaskOperations) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.listId = data.listId;
    this.boardId = data.boardId;
    this.labels = data.labels;
    this.url = data.url;
    this.operations = operations;
  }

  /**
   * Update this task. Returns a new Task with the updated data.
   * @param params - Fields to update
   * @returns New Task reflecting the server state after update
   */
  async update(params: UpdateTaskParams): Promise<Task> {
    const data = await this.operations.updateTask(
      this.id,
      params.name,
      params.description,
      params.list?.id,
      params.labels?.map((l) => l.id)
    );
    return new Task(data, this.operations);
  }
}
