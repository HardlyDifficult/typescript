import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Project } from "../src/Project.js";
import { Task } from "../src/Task.js";
import { TaskWatcher } from "../src/TaskWatcher.js";
import type { TaskListClient } from "../src/TaskListClient.js";
import type { TaskContext, TaskData } from "../src/types.js";

// --- Helpers ---

function createMockContext(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    addTaskLabel: vi.fn(),
    removeTaskLabel: vi.fn(),
    createLabel: vi.fn(),
    deleteLabel: vi.fn(),
    resolveStatusId: vi.fn((name: string) => `status-id-for-${name}`),
    resolveStatusName: vi.fn((id: string) => {
      if (id === "status-todo") return "Todo";
      if (id === "status-in-progress") return "In Progress";
      return "Unknown";
    }),
    resolveLabelId: vi.fn((name: string) => `label-id-for-${name}`),
    labels: [],
    statuses: [
      { id: "status-todo", name: "Todo" },
      { id: "status-in-progress", name: "In Progress" },
    ],
    ...overrides,
  };
}

const baseTaskData: TaskData = {
  id: "task-1",
  name: "Fix login",
  description: "Users can't log in",
  statusId: "status-todo",
  projectId: "proj-1",
  labels: [],
  url: "https://linear.app/team/task-1",
};

function makeTask(
  data: Partial<TaskData> = {},
  ctxOverrides: Partial<TaskContext> = {}
): Task {
  const ctx = createMockContext(ctxOverrides);
  return new Task({ ...baseTaskData, ...data }, ctx);
}

function makeProject(tasks: Task[] = []): Project {
  const ctx = createMockContext();
  return new Project(
    { id: "proj-1", name: "Bot", url: "https://linear.app/proj-1" },
    [
      { id: "status-todo", name: "Todo" },
      { id: "status-in-progress", name: "In Progress" },
    ],
    tasks,
    [],
    ctx
  );
}

function makeClient(project: Project): TaskListClient {
  return {
    getProjects: vi.fn().mockResolvedValue([project]),
    getProject: vi.fn().mockResolvedValue(project),
    getTask: vi.fn(),
    findProject: vi.fn().mockResolvedValue(project),
  } as unknown as TaskListClient;
}

// --- Tests ---

describe("TaskWatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor / options", () => {
    it("creates without error with required options", () => {
      const project = makeProject();
      const client = makeClient(project);
      expect(
        () =>
          new TaskWatcher(client, {
            projectName: "Bot",
            triggerStatus: "Todo",
            pickupStatus: "In Progress",
            pollIntervalMs: 5_000,
            onTask: vi.fn(),
          })
      ).not.toThrow();
    });

    it("uses default pollIntervalMs of 60_000 when not provided", async () => {
      const project = makeProject();
      const client = makeClient(project);
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        onTask: vi.fn(),
      });
      watcher.start();

      // Advance by 59 seconds — only the immediate poll should have fired
      await vi.advanceTimersByTimeAsync(59_000);
      expect(client.findProject).toHaveBeenCalledTimes(1);

      // Advance past the 60s mark — second poll fires
      await vi.advanceTimersByTimeAsync(2_000);
      expect(client.findProject).toHaveBeenCalledTimes(2);

      watcher.stop();
    });
  });

  describe("start() / stop()", () => {
    it("start() triggers an immediate poll", async () => {
      const project = makeProject();
      const client = makeClient(project);
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 10_000,
        onTask: vi.fn(),
      });

      watcher.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(client.findProject).toHaveBeenCalledWith("Bot");
      watcher.stop();
    });

    it("start() is idempotent — calling twice does not start a second interval", async () => {
      const project = makeProject();
      const client = makeClient(project);
      const onTask = vi.fn();
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 10_000,
        onTask,
      });

      watcher.start();
      watcher.start(); // second call should be a no-op

      // Advance one interval
      await vi.advanceTimersByTimeAsync(10_000);

      // findProject called once (immediate) + once (interval) = 2, not 3+
      expect(client.findProject).toHaveBeenCalledTimes(2);
    });

    it("stop() prevents further polling", async () => {
      const project = makeProject();
      const client = makeClient(project);
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 10_000,
        onTask: vi.fn(),
      });

      watcher.start();
      // Let the immediate poll fire and one interval poll fire
      await vi.advanceTimersByTimeAsync(10_000);

      const callsBefore = (client.findProject as ReturnType<typeof vi.fn>).mock
        .calls.length;
      watcher.stop();

      // Advance time further — no more polls should happen
      await vi.advanceTimersByTimeAsync(30_000);
      const callsAfter = (client.findProject as ReturnType<typeof vi.fn>).mock
        .calls.length;

      expect(callsAfter).toBe(callsBefore);
    });

    it("stop() is safe to call when not started", () => {
      const project = makeProject();
      const client = makeClient(project);
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 10_000,
        onTask: vi.fn(),
      });

      expect(() => watcher.stop()).not.toThrow();
    });

    it("polls repeatedly on the configured interval", async () => {
      const project = makeProject();
      const client = makeClient(project);
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 5_000,
        onTask: vi.fn(),
      });

      watcher.start();

      // Immediate poll
      await vi.advanceTimersByTimeAsync(0);
      expect(client.findProject).toHaveBeenCalledTimes(1);

      // +5s → second poll
      await vi.advanceTimersByTimeAsync(5_000);
      expect(client.findProject).toHaveBeenCalledTimes(2);

      // +5s → third poll
      await vi.advanceTimersByTimeAsync(5_000);
      expect(client.findProject).toHaveBeenCalledTimes(3);

      watcher.stop();
    });
  });

  describe("poll() — task pickup", () => {
    it("calls findProject with the configured project name", async () => {
      const project = makeProject();
      const client = makeClient(project);
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask: vi.fn(),
      });

      await watcher.poll();

      expect(client.findProject).toHaveBeenCalledWith("Bot");
    });

    it("moves tasks in trigger status to pickup status and calls onTask", async () => {
      const ctx = createMockContext({
        updateTask: vi.fn().mockResolvedValue({
          ...baseTaskData,
          statusId: "status-in-progress",
        }),
        resolveStatusId: vi.fn().mockReturnValue("status-in-progress"),
      });
      const task = new Task(baseTaskData, ctx);
      const project = makeProject([task]);
      const client = makeClient(project);
      const onTask = vi.fn();

      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask,
      });

      await watcher.poll();

      expect(ctx.updateTask).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: "status-in-progress" })
      );
      expect(onTask).toHaveBeenCalledOnce();

      const [calledTask, calledProject] = onTask.mock.calls[0] as [
        Task,
        Project,
      ];
      expect(calledTask).toBeInstanceOf(Task);
      expect(calledTask.status).toBe("In Progress");
      expect(calledProject).toBe(project);
    });

    it("does not call onTask when no tasks match the trigger status", async () => {
      const ctx = createMockContext();
      const task = new Task(
        { ...baseTaskData, statusId: "status-in-progress" },
        {
          ...ctx,
          resolveStatusName: vi.fn(() => "In Progress"),
        }
      );
      const project = makeProject([task]);
      const client = makeClient(project);
      const onTask = vi.fn();

      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask,
      });

      await watcher.poll();

      expect(onTask).not.toHaveBeenCalled();
    });

    it("processes multiple tasks in trigger status", async () => {
      const ctx1 = createMockContext({
        updateTask: vi.fn().mockResolvedValue({
          ...baseTaskData,
          id: "task-1",
          statusId: "status-in-progress",
        }),
        resolveStatusId: vi.fn().mockReturnValue("status-in-progress"),
      });
      const ctx2 = createMockContext({
        updateTask: vi.fn().mockResolvedValue({
          ...baseTaskData,
          id: "task-2",
          statusId: "status-in-progress",
        }),
        resolveStatusId: vi.fn().mockReturnValue("status-in-progress"),
      });
      const task1 = new Task({ ...baseTaskData, id: "task-1" }, ctx1);
      const task2 = new Task({ ...baseTaskData, id: "task-2" }, ctx2);
      const project = makeProject([task1, task2]);
      const client = makeClient(project);
      const onTask = vi.fn();

      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask,
      });

      await watcher.poll();

      expect(onTask).toHaveBeenCalledTimes(2);
    });
  });

  describe("poll() — boolean guard (concurrent poll prevention)", () => {
    it("does not start a second poll while one is in progress", async () => {
      let resolveFirstPoll!: () => void;
      const firstPollPromise = new Promise<void>(
        (resolve) => (resolveFirstPoll = resolve)
      );

      const ctx = createMockContext();
      // Make findProject hang until we resolve it
      const client = {
        findProject: vi
          .fn()
          .mockReturnValueOnce(firstPollPromise.then(() => makeProject()))
          .mockResolvedValue(makeProject()),
        getProjects: vi.fn(),
        getProject: vi.fn(),
        getTask: vi.fn(),
      } as unknown as TaskListClient;

      const onTask = vi.fn();
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask,
      });

      // Start two polls concurrently
      const p1 = watcher.poll();
      const p2 = watcher.poll(); // should return early due to guard

      resolveFirstPoll();
      await Promise.all([p1, p2]);

      // findProject should only be called once (second poll was skipped)
      expect(client.findProject).toHaveBeenCalledTimes(1);
    });
  });

  describe("poll() — error handling", () => {
    it("calls onError when findProject rejects", async () => {
      const client = {
        findProject: vi.fn().mockRejectedValue(new Error("Project not found")),
        getProjects: vi.fn(),
        getProject: vi.fn(),
        getTask: vi.fn(),
      } as unknown as TaskListClient;

      const onError = vi.fn();
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask: vi.fn(),
        onError,
      });

      await watcher.poll();

      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
      expect((onError.mock.calls[0]![0] as Error).message).toBe(
        "Project not found"
      );
    });

    it("logs to console.error when findProject rejects and no onError provided", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const client = {
        findProject: vi.fn().mockRejectedValue(new Error("Network failure")),
        getProjects: vi.fn(),
        getProject: vi.fn(),
        getTask: vi.fn(),
      } as unknown as TaskListClient;

      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask: vi.fn(),
      });

      await watcher.poll();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("calls onError when setStatus rejects for a task, but continues with remaining tasks", async () => {
      const ctx1 = createMockContext({
        updateTask: vi.fn().mockRejectedValue(new Error("API error")),
        resolveStatusId: vi.fn().mockReturnValue("status-in-progress"),
      });
      const ctx2 = createMockContext({
        updateTask: vi.fn().mockResolvedValue({
          ...baseTaskData,
          id: "task-2",
          statusId: "status-in-progress",
        }),
        resolveStatusId: vi.fn().mockReturnValue("status-in-progress"),
      });
      const task1 = new Task({ ...baseTaskData, id: "task-1" }, ctx1);
      const task2 = new Task({ ...baseTaskData, id: "task-2" }, ctx2);
      const project = makeProject([task1, task2]);
      const client = makeClient(project);
      const onTask = vi.fn();
      const onError = vi.fn();

      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask,
        onError,
      });

      await watcher.poll();

      // Error for task-1, but task-2 still processed
      expect(onError).toHaveBeenCalledOnce();
      expect(onTask).toHaveBeenCalledOnce();
    });

    it("wraps non-Error poll failures in an Error", async () => {
      const client = {
        findProject: vi.fn().mockRejectedValue("string error"),
        getProjects: vi.fn(),
        getProject: vi.fn(),
        getTask: vi.fn(),
      } as unknown as TaskListClient;

      const onError = vi.fn();
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask: vi.fn(),
        onError,
      });

      await watcher.poll();

      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    });

    it("releases the polling guard after an error so subsequent polls can run", async () => {
      const client = {
        findProject: vi
          .fn()
          .mockRejectedValueOnce(new Error("temporary error"))
          .mockResolvedValue(makeProject()),
        getProjects: vi.fn(),
        getProject: vi.fn(),
        getTask: vi.fn(),
      } as unknown as TaskListClient;

      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask: vi.fn(),
        onError: vi.fn(),
      });

      await watcher.poll(); // fails
      await watcher.poll(); // should succeed (guard was released)

      expect(client.findProject).toHaveBeenCalledTimes(2);
    });
  });

  describe("dedup via status change", () => {
    it("tasks already in pickup status are not re-processed on next poll", async () => {
      // First poll: one task in Todo → gets moved to In Progress
      const ctx = createMockContext({
        updateTask: vi.fn().mockResolvedValue({
          ...baseTaskData,
          statusId: "status-in-progress",
        }),
        resolveStatusId: vi.fn().mockReturnValue("status-in-progress"),
      });
      const todoTask = new Task(baseTaskData, ctx);

      // After update, the project returned on next poll has the task in In Progress
      const inProgressCtx = createMockContext({
        resolveStatusName: vi.fn(() => "In Progress"),
      });
      const inProgressTask = new Task(
        { ...baseTaskData, statusId: "status-in-progress" },
        inProgressCtx
      );

      const projectWithTodo = makeProject([todoTask]);
      const projectWithInProgress = makeProject([inProgressTask]);

      const client = {
        findProject: vi
          .fn()
          .mockResolvedValueOnce(projectWithTodo)
          .mockResolvedValue(projectWithInProgress),
        getProjects: vi.fn(),
        getProject: vi.fn(),
        getTask: vi.fn(),
      } as unknown as TaskListClient;

      const onTask = vi.fn();
      const watcher = new TaskWatcher(client, {
        projectName: "Bot",
        triggerStatus: "Todo",
        pickupStatus: "In Progress",
        pollIntervalMs: 60_000,
        onTask,
      });

      await watcher.poll(); // processes todo task
      expect(onTask).toHaveBeenCalledTimes(1);

      await watcher.poll(); // task now in progress — should not trigger again
      expect(onTask).toHaveBeenCalledTimes(1);
    });
  });
});
