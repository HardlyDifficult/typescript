import { duration } from "@hardlydifficult/date-time";

import type { TaskList } from "./TaskList.js";
import type { TaskWatchHandle, TaskWatchOptions } from "./types.js";

export class TaskWatcher implements TaskWatchHandle {
  private readonly taskList: TaskList;
  private readonly options: Required<
    Pick<TaskWatchOptions, "project" | "whenStatus" | "moveTo" | "everyMs">
  > &
    Pick<TaskWatchOptions, "onTask" | "onError">;
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(taskList: TaskList, options: TaskWatchOptions) {
    this.taskList = taskList;
    this.options = {
      project: options.project,
      whenStatus: options.whenStatus,
      moveTo: options.moveTo,
      everyMs: options.everyMs ?? duration({ minutes: 1 }),
      onTask: options.onTask,
      onError: options.onError,
    };
  }

  start(): this {
    if (this.timer !== null) {
      return this;
    }

    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.options.everyMs);
    this.timer.unref();
    return this;
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll(): Promise<void> {
    if (this.polling) {
      return;
    }

    this.polling = true;

    try {
      const project = await this.taskList.project(this.options.project);
      const tasks = project.tasks({ status: this.options.whenStatus });

      for (const task of tasks) {
        try {
          await task.moveTo(this.options.moveTo);
          await this.options.onTask(task, project);
        } catch (error) {
          this.handleError(error);
        }
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.polling = false;
    }
  }

  private handleError(error: unknown): void {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));

    if (this.options.onError) {
      this.options.onError(normalizedError);
      return;
    }

    console.error("TaskWatcher failed:", normalizedError.message);
  }
}
