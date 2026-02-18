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
   * Get all projects with full state (statuses, tasks, labels).
   */
  abstract getProjects(): Promise<Project[]>;

  /**
   * Get a single project with full state.
   * @param projectId - Project identifier
   */
  abstract getProject(projectId: string): Promise<Project>;

  /**
   * Get a single task by ID.
   * @param taskId - Task identifier
   */
  abstract getTask(taskId: string): Promise<Task>;

  /**
   * Find a project by name (case-insensitive partial match).
   * @param name - Partial project name to search for
   * @returns The matching Project
   * @throws Error if no project matches
   */
  async findProject(name: string): Promise<Project> {
    const projects = await this.getProjects();
    const lower = name.toLowerCase();
    const project = projects.find((p) =>
      p.name.toLowerCase().includes(lower)
    );
    if (!project) {
      throw new Error(`Project "${name}" not found`);
    }
    return project;
  }
}
