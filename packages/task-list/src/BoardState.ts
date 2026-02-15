import type { Task } from "./Task.js";
import type { TaskList } from "./TaskList.js";
import type { Board, Label } from "./types.js";

/**
 * Full state of a single board: board info, lists, tasks, and labels.
 * Provides chainable finder methods that throw on not found.
 */
export class BoardState {
  readonly board: Board;
  readonly lists: readonly TaskList[];
  readonly tasks: readonly Task[];
  readonly labels: readonly Label[];

  constructor(
    board: Board,
    lists: readonly TaskList[],
    tasks: readonly Task[],
    labels: readonly Label[]
  ) {
    this.board = board;
    this.lists = lists;
    this.tasks = tasks;
    this.labels = labels;
  }

  /**
   * Find a list by name (case-insensitive partial match)
   * @param name - Partial list name to search for
   * @returns The matching TaskList
   * @throws Error if no list matches
   */
  findList(name: string): TaskList {
    const lower = name.toLowerCase();
    const list = this.lists.find((l) => l.name.toLowerCase().includes(lower));
    if (!list) {
      throw new Error(`List "${name}" not found on board "${this.board.name}"`);
    }
    return list;
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
        `Task "${taskId}" not found on board "${this.board.name}"`
      );
    }
    return task;
  }

  /**
   * Find a label by name (case-insensitive partial match)
   * @param name - Partial label name to search for
   * @returns The matching Label
   * @throws Error if no label matches
   */
  findLabel(name: string): Label {
    const lower = name.toLowerCase();
    const label = this.labels.find((l) => l.name.toLowerCase().includes(lower));
    if (!label) {
      throw new Error(
        `Label "${name}" not found on board "${this.board.name}"`
      );
    }
    return label;
  }
}
