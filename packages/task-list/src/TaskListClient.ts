import type { FullState } from "./FullState.js";
import type { Project } from "./Project.js";
import type { Task } from "./Task.js";
import type { TaskListConfig } from "./types.js";

/**
 * Abstract base class for task list platform clients.
 * Provides a unified API for Trello, Linear, and future providers.
 */
export abstract class TaskListClient {
  constructor(protected readonly config: TaskListConfig) {}

  /**
   * Get all projects with full state (statuses, tasks, labels)
   * @returns FullState with chainable finders
   */
  abstract getProjects(): Promise<FullState>;

  /**
   * Get a single project with full state
   * @param projectId - Project identifier
   * @returns Project with task creation and lookup
   */
  abstract getProject(projectId: string): Promise<Project>;

  /**
   * Get a single task by ID
   * @param taskId - Task identifier
   * @returns Task with update capability
   */
  abstract getTask(taskId: string): Promise<Task>;

  /**
   * Find a project by name (case-insensitive partial match).
   * Convenience method that fetches all projects then finds by name.
   * @param name - Partial project name to search for
   * @returns The matching Project
   * @throws Error if no project matches
   */
  async findProject(name: string): Promise<Project> {
    const state = await this.getProjects();
    return state.findProject(name);
  }
}
