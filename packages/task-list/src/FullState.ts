import type { Project } from "./Project.js";
import type { Task } from "./Task.js";

/**
 * Full state across all projects.
 * Provides chainable finder methods that throw on not found.
 *
 * @example
 * ```typescript
 * const state = await client.getProjects();
 * const project = state.findProject("Alpha");
 * const task = await project.createTask("New task");
 * ```
 */
export class FullState {
  readonly projects: readonly Project[];

  constructor(projects: readonly Project[]) {
    this.projects = projects;
  }

  /**
   * Find a project by name (case-insensitive partial match).
   * @param name - Partial project name to search for
   * @returns The matching Project
   * @throws Error if no project matches
   */
  findProject(name: string): Project {
    const lower = name.toLowerCase();
    const project = this.projects.find((p) =>
      p.name.toLowerCase().includes(lower)
    );
    if (!project) {
      throw new Error(`Project "${name}" not found`);
    }
    return project;
  }

  /**
   * Find a task by ID across all projects
   * @param taskId - Task ID to find
   * @returns The matching Task
   * @throws Error if no task matches on any project
   */
  findTask(taskId: string): Task {
    for (const project of this.projects) {
      const task = project.tasks.find((t) => t.id === taskId);
      if (task) {
        return task;
      }
    }
    throw new Error(`Task "${taskId}" not found in any project`);
  }
}
