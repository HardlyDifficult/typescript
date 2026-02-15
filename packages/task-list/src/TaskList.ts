import { Task } from "./Task.js";
import type {
  CreateTaskOptions,
  TaskListData,
  TaskOperations,
} from "./types.js";

/**
 * A task list (Trello List, Linear Status) with task creation capability
 */
export class TaskList {
  readonly id: string;
  readonly name: string;
  readonly boardId: string;

  private readonly operations: TaskOperations;

  constructor(data: TaskListData, operations: TaskOperations) {
    this.id = data.id;
    this.name = data.name;
    this.boardId = data.boardId;
    this.operations = operations;
  }

  /**
   * Create a new task in this list
   * @param name - Task name/title
   * @param options - Optional description and labels
   * @returns The created Task
   */
  async createTask(name: string, options?: CreateTaskOptions): Promise<Task> {
    const data = await this.operations.createTask(
      this.id,
      name,
      options?.description,
      options?.labels?.map((l) => l.id)
    );
    return new Task(data, this.operations);
  }
}
