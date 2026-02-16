import type { FullState } from "./FullState.js";
import { findBestMatch } from "./migration.js";
import type { Project } from "./Project.js";
import type { Task } from "./Task.js";
import type {
  MigratedTask,
  MigrationResult,
  TaskListConfig,
} from "./types.js";

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

  /**
   * Migrate all projects and tasks from this client to a destination client.
   * Projects are matched by name, statuses and labels by fuzzy matching.
   * Unmatched statuses fall back to the destination's default; unmatched labels are dropped.
   *
   * @param destination - The TaskListClient to migrate data into
   * @returns MigrationResult with per-task details
   */
  async migrateTo(destination: TaskListClient): Promise<MigrationResult> {
    const sourceState = await this.getProjects();
    const destState = await destination.getProjects();

    const tasks: MigratedTask[] = [];
    let projectsMatched = 0;
    let tasksCreated = 0;
    let tasksFailed = 0;

    for (const sourceProject of sourceState.projects) {
      const destProject = this.findMatchingProject(
        sourceProject,
        destState.projects
      );

      if (!destProject) {
        for (const task of sourceProject.tasks) {
          tasksFailed++;
          tasks.push({
            sourceTaskId: task.id,
            sourceTaskName: task.name,
            sourceProjectName: sourceProject.name,
            error: `No matching destination project for "${sourceProject.name}"`,
          });
        }
        continue;
      }

      projectsMatched++;

      for (const sourceTask of sourceProject.tasks) {
        try {
          const created = await this.migrateTask(sourceTask, destProject);
          tasksCreated++;
          tasks.push({
            sourceTaskId: sourceTask.id,
            sourceTaskName: sourceTask.name,
            sourceProjectName: sourceProject.name,
            destinationTaskId: created.id,
          });
        } catch (err) {
          tasksFailed++;
          tasks.push({
            sourceTaskId: sourceTask.id,
            sourceTaskName: sourceTask.name,
            sourceProjectName: sourceProject.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return { projectsMatched, tasksCreated, tasksFailed, tasks };
  }

  private findMatchingProject(
    sourceProject: Project,
    destProjects: readonly Project[]
  ): Project | undefined {
    return destProjects.find(
      (dp) =>
        findBestMatch(sourceProject.name, [dp.name]) !== undefined
    );
  }

  private async migrateTask(
    sourceTask: Task,
    destProject: Project
  ): Promise<Task> {
    const matchedStatus = findBestMatch(
      sourceTask.status,
      destProject.statuses
    );

    const matchedLabels = sourceTask.labels
      .map((label) => findBestMatch(label, destProject.labels))
      .filter((l): l is string => l !== undefined);

    return destProject.createTask(sourceTask.name, {
      description: sourceTask.description || undefined,
      status: matchedStatus,
      labels: matchedLabels.length > 0 ? matchedLabels : undefined,
    });
  }
}
