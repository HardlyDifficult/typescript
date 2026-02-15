import type { BoardState } from "./BoardState.js";
import type { Task } from "./Task.js";

/**
 * Full state across all boards.
 * Provides chainable finder methods that throw on not found.
 *
 * @example
 * ```typescript
 * const state = await client.getBoards();
 * const list = state.findBoard("Alpha").findList("To Do");
 * const task = await list.createTask("New task");
 * ```
 */
export class FullState {
  readonly boards: readonly BoardState[];

  constructor(boards: readonly BoardState[]) {
    this.boards = boards;
  }

  /**
   * Find a board by name (case-insensitive partial match).
   * Returns a BoardState, enabling chaining: `state.findBoard("X").findList("Y")`
   * @param name - Partial board name to search for
   * @returns The matching BoardState
   * @throws Error if no board matches
   */
  findBoard(name: string): BoardState {
    const lower = name.toLowerCase();
    const board = this.boards.find((b) =>
      b.board.name.toLowerCase().includes(lower)
    );
    if (!board) {
      throw new Error(`Board "${name}" not found`);
    }
    return board;
  }

  /**
   * Find a task by ID across all boards
   * @param taskId - Task ID to find
   * @returns The matching Task
   * @throws Error if no task matches on any board
   */
  findTask(taskId: string): Task {
    for (const boardState of this.boards) {
      const task = boardState.tasks.find((t) => t.id === taskId);
      if (task) {
        return task;
      }
    }
    throw new Error(`Task "${taskId}" not found on any board`);
  }
}
