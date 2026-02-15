import type { BoardState } from "./BoardState.js";
import type { FullState } from "./FullState.js";
import type { Task } from "./Task.js";
import type { TaskListConfig } from "./types.js";

/**
 * Abstract base class for task list platform clients.
 * Provides a unified API for Trello, Linear, and future providers.
 */
export abstract class TaskListClient {
  constructor(protected readonly config: TaskListConfig) {}

  /**
   * Get full state for all boards (boards, lists, tasks, labels)
   * @returns FullState with chainable finders
   */
  abstract getBoards(): Promise<FullState>;

  /**
   * Get full state for a single board (lists, tasks, labels)
   * @param boardId - Board identifier
   * @returns BoardState with chainable finders
   */
  abstract getBoard(boardId: string): Promise<BoardState>;

  /**
   * Get a single task by ID
   * @param taskId - Task identifier
   * @returns Task with update capability
   */
  abstract getTask(taskId: string): Promise<Task>;
}
