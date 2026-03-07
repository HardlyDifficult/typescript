import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Project } from "../src/Project.js";
import { TaskList } from "../src/TaskList.js";
import { TaskListClient } from "../src/TaskListClient.js";
import {
  ProjectNotFoundError,
  TaskListProviderNotConfiguredError,
  createTaskList,
} from "../src/index.js";
import type {
  Label,
  ProjectSnapshot,
  Status,
  TaskContext,
  TaskData,
  TaskSnapshot,
} from "../src/types.js";

const statuses: readonly Status[] = [
  { id: "status-1", name: "Todo" },
  { id: "status-2", name: "In Progress" },
];

const labels: readonly Label[] = [
  { id: "label-1", name: "Bug", color: "#ff0000" },
];

const baseTaskData: TaskData = {
  id: "task-1",
  title: "Fix login",
  description: "Users cannot log in",
  statusId: "status-1",
  projectId: "project-1",
  labels: [labels[0]!],
  url: "https://example.com/tasks/1",
};

function createMockContext(overrides: Partial<TaskContext> = {}): TaskContext {
  const context: TaskContext = {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    fetchTask: vi.fn(),
    fetchProject: vi.fn(),
    createLabel: vi.fn(),
    deleteLabel: vi.fn(),
    resolveStatusId: vi.fn((name: string) =>
      name.toLowerCase() === "in progress" ? "status-2" : "status-1"
    ),
    resolveStatusName: vi.fn((id: string) =>
      id === "status-2" ? "In Progress" : "Todo"
    ),
    resolveLabelId: vi.fn(() => "label-1"),
    labels,
    statuses,
    ...overrides,
  };

  return context;
}

function createTaskSnapshot(
  data: TaskData = baseTaskData,
  context: TaskContext = createMockContext()
): TaskSnapshot {
  return { task: data, context };
}

function createProjectSnapshot(
  taskData: readonly TaskData[] = [baseTaskData],
  context: TaskContext = createMockContext()
): ProjectSnapshot {
  return {
    info: {
      id: "project-1",
      name: "Bot",
      url: "https://example.com/projects/1",
    },
    statuses,
    labels,
    tasks: taskData,
    context,
  };
}

class FakeClient extends TaskListClient {
  readonly provider = "linear" as const;

  readonly getProjects = vi.fn(async () => this.projectsFactory());
  readonly getProject = vi.fn(async (projectId: string) => {
    return this.projectsFactory().then((projects) => {
      return projects.find((project) => project.id === projectId)!;
    });
  });
  readonly getTask = vi.fn(async (taskId: string) => {
    return this.projectsFactory().then((projects) => {
      return projects.flatMap((project) => project.tasks()).find((task) => task.id === taskId)!;
    });
  });

  constructor(private readonly projectsFactory: () => Promise<Project[]>) {
    super({ provider: "linear" });
  }
}

describe("createTaskList", () => {
  const originalEnv = {
    LINEAR_API_KEY: process.env.LINEAR_API_KEY,
    TRELLO_API_KEY: process.env.TRELLO_API_KEY,
    TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN,
  };
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    delete process.env.LINEAR_API_KEY;
    delete process.env.TRELLO_API_KEY;
    delete process.env.TRELLO_API_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalEnv.LINEAR_API_KEY === undefined) {
      delete process.env.LINEAR_API_KEY;
    } else {
      process.env.LINEAR_API_KEY = originalEnv.LINEAR_API_KEY;
    }
    if (originalEnv.TRELLO_API_KEY === undefined) {
      delete process.env.TRELLO_API_KEY;
    } else {
      process.env.TRELLO_API_KEY = originalEnv.TRELLO_API_KEY;
    }
    if (originalEnv.TRELLO_API_TOKEN === undefined) {
      delete process.env.TRELLO_API_TOKEN;
    } else {
      process.env.TRELLO_API_TOKEN = originalEnv.TRELLO_API_TOKEN;
    }
  });

  it("defaults to the Linear provider", async () => {
    process.env.LINEAR_API_KEY = "lin_test";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            teams: { nodes: [{ id: "team-1", name: "Core" }] },
          },
        }),
    } as Response);

    const taskList = await createTaskList();

    expect(taskList.provider).toBe("linear");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("requires explicit Trello selection instead of auto-falling back", async () => {
    process.env.TRELLO_API_KEY = "trello_key";
    process.env.TRELLO_API_TOKEN = "trello_token";

    await expect(createTaskList()).rejects.toBeInstanceOf(
      TaskListProviderNotConfiguredError
    );
  });

  it("supports explicit Trello configuration", async () => {
    const taskList = await createTaskList({
      provider: "trello",
      apiKey: "trello_key",
      token: "trello_token",
    });

    expect(taskList.provider).toBe("trello");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("resolves the Linear team during creation so later calls just work", async () => {
    process.env.LINEAR_API_KEY = "lin_test";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            teams: { nodes: [{ id: "team-1", name: "Core" }] },
          },
        }),
    } as Response);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            issue: {
              id: "ISS-1",
              title: "Fix login",
              description: "Users cannot log in",
              url: "https://linear.app/issue/ISS-1",
              priority: 2,
              state: { id: "status-1" },
              team: { id: "team-1" },
              project: { id: "project-1" },
              labels: { nodes: [] },
            },
            team: {
              states: { nodes: [{ id: "status-1", name: "Todo" }] },
              labels: { nodes: [] },
            },
          },
        }),
    } as Response);

    const taskList = await createTaskList({ team: "Core" });
    const task = await taskList.task("ISS-1");

    expect(task.title).toBe("Fix login");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string)
        .query
    ).toContain("teams");
  });
});

describe("TaskList session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("finds projects by exact case-insensitive name", async () => {
    const project = new Project(createProjectSnapshot());
    const taskList = new TaskList(
      new FakeClient(async () => [project, new Project(createProjectSnapshot([], createMockContext()))])
    );

    await expect(taskList.project("bot")).resolves.toBe(project);
    await expect(taskList.project("bo")).rejects.toBeInstanceOf(
      ProjectNotFoundError
    );
  });

  it("createTask() routes through the resolved project", async () => {
    const context = createMockContext({
      createTask: vi.fn().mockResolvedValue(createTaskSnapshot(baseTaskData)),
    });
    const project = new Project(createProjectSnapshot([], context));
    const taskList = new TaskList(new FakeClient(async () => [project]));

    const task = await taskList.createTask({
      project: "bot",
      title: "Fix login",
      labels: ["Bug"],
    });

    expect(task.title).toBe("Fix login");
    expect(context.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Fix login" })
    );
  });

  it("watch() polls immediately and on the configured interval", async () => {
    const context = createMockContext({
      updateTask: vi.fn().mockResolvedValue(
        createTaskSnapshot({
          ...baseTaskData,
          statusId: "status-2",
        })
      ),
    });
    const project = new Project(createProjectSnapshot([baseTaskData], context));
    const client = new FakeClient(async () => [project]);
    const taskList = new TaskList(client);
    const onTask = vi.fn();

    const watch = taskList.watch({
      project: "Bot",
      whenStatus: "Todo",
      moveTo: "In Progress",
      everyMs: 5_000,
      onTask,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(client.getProjects).toHaveBeenCalledTimes(1);
    expect(onTask).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(client.getProjects).toHaveBeenCalledTimes(2);
    expect(onTask).toHaveBeenCalledTimes(1);

    watch.stop();
  });

  it("watch().stop() prevents future polling", async () => {
    const project = new Project(createProjectSnapshot([]));
    const client = new FakeClient(async () => [project]);
    const taskList = new TaskList(client);

    const watch = taskList.watch({
      project: "Bot",
      whenStatus: "Todo",
      moveTo: "In Progress",
      everyMs: 5_000,
      onTask: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(0);
    watch.stop();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(client.getProjects).toHaveBeenCalledTimes(1);
  });

  it("watch() avoids overlapping polls", async () => {
    let resolveProjects: ((projects: Project[]) => void) | undefined;
    const client = new FakeClient(
      () =>
        new Promise<Project[]>((resolve) => {
          resolveProjects = resolve;
        })
    );
    const taskList = new TaskList(client);

    const watch = taskList.watch({
      project: "Bot",
      whenStatus: "Todo",
      moveTo: "In Progress",
      everyMs: 5_000,
      onTask: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(client.getProjects).toHaveBeenCalledTimes(1);

    resolveProjects?.([new Project(createProjectSnapshot([]))]);
    await vi.advanceTimersByTimeAsync(0);
    watch.stop();
  });

  it("watch() routes task failures to onError", async () => {
    const expected = new Error("move failed");
    const context = createMockContext({
      updateTask: vi.fn().mockRejectedValue(expected),
    });
    const project = new Project(createProjectSnapshot([baseTaskData], context));
    const taskList = new TaskList(new FakeClient(async () => [project]));
    const onError = vi.fn();

    const watch = taskList.watch({
      project: "Bot",
      whenStatus: "Todo",
      moveTo: "In Progress",
      onTask: vi.fn(),
      onError,
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(onError).toHaveBeenCalledWith(expected);
    watch.stop();
  });
});
