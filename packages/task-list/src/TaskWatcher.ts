import { MILLISECONDS_PER_MINUTE } from "@hardlydifficult/date-time";

import type { Project } from "./Project.js";
import type { Task } from "./Task.js";
import type { TaskListClient } from "./TaskListClient.js";

/**
 * Options for creating a TaskWatcher.
 */
export interface TaskWatcherOptions {
  /** Project name to watch */
  readonly projectName: string;
  /** Watch for tasks in this status (e.g., "Todo") */
  readonly triggerStatus: string;
  /** Move tasks to this status on pickup (e.g., "In Progress") */
  readonly pickupStatus: string;
  /** Poll interval in ms (default: MILLISECONDS_PER_MINUTE) */
  readonly pollIntervalMs?: number;
  /** Called when a new task is found. Task has already been moved to pickupStatus. */
  readonly onTask: (task: Task, project: Project) => void;
  /** Called on poll errors (default: log to console.error) */
  readonly onError?: (error: Error) => void;
}

/**
 * Watches a project for tasks in a trigger status and dispatches them.
 *
 * Dedup is handled via status change: tasks are moved to `pickupStatus` on
 * detection, so they won't appear in the next poll. No separate state tracking
 * is needed.
 *
 * @example
 * ```typescript
 * const client = await createTaskListClient({ type: "linear" });
 * const watcher = new TaskWatcher(client, {
 *   projectName: "Bot",
 *   triggerStatus: "Todo",
 *   pickupStatus: "In Progress",
 *   pollIntervalMs: MILLISECONDS_PER_MINUTE,
 *   onTask: (task, project) => console.log("Found:", task.name),
 * });
 * watcher.start();
 * ```
 */
export class TaskWatcher {
  private readonly client: TaskListClient;
  private readonly options: Required<
    Pick<
      TaskWatcherOptions,
      "projectName" | "triggerStatus" | "pickupStatus" | "pollIntervalMs"
    >
  > &
    Pick<TaskWatcherOptions, "onTask" | "onError">;
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(client: TaskListClient, options: TaskWatcherOptions) {
    this.client = client;
    this.options = {
      projectName: options.projectName,
      triggerStatus: options.triggerStatus,
      pickupStatus: options.pickupStatus,
      pollIntervalMs: options.pollIntervalMs ?? MILLISECONDS_PER_MINUTE,
      onTask: options.onTask,
      onError: options.onError,
    };
  }

  /** Start polling. Does nothing if already started. */
  start(): void {
    if (this.timer !== null) {
      return;
    }
    // Run immediately on start, then on interval
    void this.poll();
    this.timer = setInterval(
      () => void this.poll(),
      this.options.pollIntervalMs
    );
    this.timer.unref();
  }

  /** Stop polling and clean up. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Single poll cycle. Exported for testing. */
  async poll(): Promise<void> {
    if (this.polling) {
      return;
    }
    this.polling = true;

    try {
      const project = await this.client.findProject(this.options.projectName);
      const tasks = project.getTasks({ status: this.options.triggerStatus });

      for (const task of tasks) {
        try {
          const updated = await task.setStatus(this.options.pickupStatus);
          this.options.onTask(updated, project);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          if (this.options.onError) {
            this.options.onError(error);
          } else {
            console.error(
              `TaskWatcher: failed to pick up task "${task.name}":`,
              error.message
            );
          }
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (this.options.onError) {
        this.options.onError(error);
      } else {
        console.error("TaskWatcher: poll failed:", error.message);
      }
    } finally {
      this.polling = false;
    }
  }
}

