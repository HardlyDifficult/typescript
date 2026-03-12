/**
 * Additional tests to achieve 100% coverage for the task-list package.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Project } from "../src/Project.js";
import { Task } from "../src/Task.js";
import { TaskList } from "../src/TaskList.js";
import { TaskListClient } from "../src/TaskListClient.js";
import { TaskWatcher } from "../src/TaskWatcher.js";
import {
  InvalidPriorityError,
  LabelNotFoundError,
  LinearGraphQLError,
  MultipleTeamsFoundError,
  NoTeamsFoundError,
  ProjectNotFoundError,
  StatusIdNotFoundError,
  StatusNotFoundError,
  TaskListApiError,
  TaskListError,
  TaskListProviderNotConfiguredError,
  TaskNotFoundError,
  TeamNotFoundError,
  UnknownTaskListProviderError,
  createTaskList,
} from "../src/index.js";
import { LinearTaskListClient } from "../src/linear/index.js";
import { buildContextResolvers } from "../src/resolvers.js";
import { TrelloTaskListClient } from "../src/trello/TrelloTaskListClient.js";
import type {
  Label,
  ProjectSnapshot,
  Status,
  TaskContext,
  TaskData,
  TaskSnapshot,
} from "../src/types.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const statuses: readonly Status[] = [
  { id: "status-1", name: "Todo" },
  { id: "status-2", name: "In Progress" },
];

const labels: readonly Label[] = [
  { id: "label-1", name: "Bug", color: "#ff0000" },
  { id: "label-2", name: "Feature", color: "#00ff00" },
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
  return {
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
}

function makeTaskSnapshot(
  data: TaskData = baseTaskData,
  context: TaskContext = createMockContext()
): TaskSnapshot {
  return { task: data, context };
}

function makeProjectSnapshot(
  tasks: readonly TaskData[] = [baseTaskData],
  context: TaskContext = createMockContext()
): ProjectSnapshot {
  return {
    info: { id: "project-1", name: "Bot", url: "https://example.com/p1" },
    statuses,
    labels,
    tasks,
    context,
  };
}

// ---------------------------------------------------------------------------
// errors.ts — uncovered constructors and formatAvailable branches
// ---------------------------------------------------------------------------

describe("error classes", () => {
  it("TaskListError stores code and details", () => {
    const err = new TaskListError("msg", "CODE", { key: "val" });
    expect(err.code).toBe("CODE");
    expect(err.details).toEqual({ key: "val" });
    expect(err.name).toBe("TaskListError");
  });

  it("UnknownTaskListProviderError includes provider in message", () => {
    const err = new UnknownTaskListProviderError("foo");
    expect(err.message).toContain("foo");
    expect(err.code).toBe("UNKNOWN_PROVIDER");
  });

  it("TaskListProviderNotConfiguredError for linear with missing", () => {
    const err = new TaskListProviderNotConfiguredError("linear", [
      "Set LINEAR_API_KEY",
    ]);
    expect(err.message).toContain("Linear");
    expect(err.message).toContain("Set LINEAR_API_KEY");
  });

  it("TaskListProviderNotConfiguredError for linear with empty missing array", () => {
    const err = new TaskListProviderNotConfiguredError("linear");
    expect(err.message).toContain("Linear");
    expect(err.message).not.toContain("Available");
  });

  it("TaskListProviderNotConfiguredError for trello", () => {
    const err = new TaskListProviderNotConfiguredError("trello", [
      "Set TRELLO_API_KEY",
    ]);
    expect(err.message).toContain("Trello");
    expect(err.message).toContain("Set TRELLO_API_KEY");
  });

  it("ProjectNotFoundError includes available projects", () => {
    const err = new ProjectNotFoundError("MyProj", ["Other"]);
    expect(err.message).toContain("MyProj");
    expect(err.message).toContain("Other");
  });

  it("ProjectNotFoundError with no available projects (formatAvailable empty branch)", () => {
    const err = new ProjectNotFoundError("MyProj", []);
    expect(err.message).toContain("MyProj");
    expect(err.message).not.toContain("Available");
  });

  it("TaskNotFoundError includes taskId and project name", () => {
    const err = new TaskNotFoundError("task-99", "MyProject", ["task-1"]);
    expect(err.message).toContain("task-99");
    expect(err.message).toContain("MyProject");
  });

  it("StatusNotFoundError with projectName", () => {
    const err = new StatusNotFoundError("Done", "MyProject", ["Todo"]);
    expect(err.message).toContain("Done");
    expect(err.message).toContain("MyProject");
  });

  it("StatusNotFoundError without projectName", () => {
    const err = new StatusNotFoundError("Done", undefined, ["Todo"]);
    expect(err.message).toContain("Done");
    expect(err.message).not.toContain("undefined");
  });

  it("StatusIdNotFoundError includes id", () => {
    const err = new StatusIdNotFoundError("bad-id", ["Todo"]);
    expect(err.message).toContain("bad-id");
  });

  it("LabelNotFoundError with projectName", () => {
    const err = new LabelNotFoundError("Tag", "Proj", ["Bug"]);
    expect(err.message).toContain("Tag");
    expect(err.message).toContain("Proj");
  });

  it("LabelNotFoundError without projectName", () => {
    const err = new LabelNotFoundError("Tag", undefined, ["Bug"]);
    expect(err.message).toContain("Tag");
    expect(err.message).not.toContain("undefined");
  });

  it("TeamNotFoundError includes team name and available teams", () => {
    const err = new TeamNotFoundError("Missing", ["Core", "Ops"]);
    expect(err.message).toContain("Missing");
    expect(err.message).toContain("Core");
  });

  it("NoTeamsFoundError has the correct message", () => {
    const err = new NoTeamsFoundError();
    expect(err.message).toContain("No teams found");
    expect(err.code).toBe("NO_TEAMS_FOUND");
  });

  it("MultipleTeamsFoundError includes team names", () => {
    const err = new MultipleTeamsFoundError(["Core", "Ops"]);
    expect(err.message).toContain("Multiple teams");
    expect(err.message).toContain("Core");
  });

  it("TaskListApiError for linear", () => {
    const err = new TaskListApiError("linear", 401, "Unauthorized");
    expect(err.message).toContain("Linear");
    expect(err.message).toContain("401");
  });

  it("TaskListApiError for trello", () => {
    const err = new TaskListApiError("trello", 403, "Forbidden");
    expect(err.message).toContain("Trello");
    expect(err.message).toContain("403");
  });

  it("LinearGraphQLError includes the message", () => {
    const err = new LinearGraphQLError("Issue not found");
    expect(err.message).toContain("Issue not found");
    expect(err.code).toBe("LINEAR_GRAPHQL_ERROR");
  });

  it("InvalidPriorityError includes the priority name", () => {
    const err = new InvalidPriorityError("SuperUrgent");
    expect(err.message).toContain("SuperUrgent");
    expect(err.code).toBe("INVALID_PRIORITY");
  });
});

// ---------------------------------------------------------------------------
// resolvers.ts — error paths for buildContextResolvers
// ---------------------------------------------------------------------------

describe("buildContextResolvers error paths", () => {
  const resolvers = buildContextResolvers(statuses, labels);

  it("resolveStatusId throws StatusNotFoundError for unknown name", () => {
    expect(() => resolvers.resolveStatusId("NonExistent")).toThrow(
      StatusNotFoundError
    );
  });

  it("resolveStatusName throws StatusIdNotFoundError for unknown id", () => {
    expect(() => resolvers.resolveStatusName("bad-id")).toThrow(
      StatusIdNotFoundError
    );
  });

  it("resolveLabelId throws LabelNotFoundError for unknown name", () => {
    expect(() => resolvers.resolveLabelId("UnknownLabel")).toThrow(
      LabelNotFoundError
    );
  });
});

// ---------------------------------------------------------------------------
// index.ts — createTaskList edge cases
// ---------------------------------------------------------------------------

describe("createTaskList edge cases", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    delete process.env.LINEAR_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws UnknownTaskListProviderError for unknown provider", async () => {
    await expect(
      createTaskList({ provider: "foobar" } as never)
    ).rejects.toBeInstanceOf(UnknownTaskListProviderError);
  });

  it("throws TaskListProviderNotConfiguredError when LINEAR_API_KEY is missing", async () => {
    await expect(createTaskList()).rejects.toBeInstanceOf(
      TaskListProviderNotConfiguredError
    );
  });

  it("creates a Trello TaskList with explicit provider config", async () => {
    const taskList = await createTaskList({
      provider: "trello",
      apiKey: "my-key",
      token: "my-token",
    });
    expect(taskList.provider).toBe("trello");
  });
});

// ---------------------------------------------------------------------------
// TaskListClient.ts — initialize() default return
// ---------------------------------------------------------------------------

describe("TaskListClient.initialize()", () => {
  class TestClient extends TaskListClient {
    readonly provider = "linear" as const;
    async getProjects() {
      return [];
    }
    async getProject() {
      return new Project(makeProjectSnapshot());
    }
    async getTask() {
      return new Task(makeTaskSnapshot());
    }
  }

  it("returns void by default (no-op)", async () => {
    const client = new TestClient({ provider: "linear" });
    await expect(client.initialize()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TaskWatcher.ts — start idempotency, stop when null, handleError branches
// ---------------------------------------------------------------------------

describe("TaskWatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("start() is idempotent — calling it twice doesn't schedule two intervals", async () => {
    const project = new Project(makeProjectSnapshot([]));
    const client = {
      provider: "linear" as const,
      getProjects: vi.fn(async () => [project]),
      getProject: vi.fn(),
      getTask: vi.fn(),
      initialize: vi.fn(async () => undefined),
    } as unknown as TaskListClient;
    const taskList = new TaskList(client);

    const watcher = new TaskWatcher(taskList, {
      project: "Bot",
      whenStatus: "Todo",
      moveTo: "In Progress",
      everyMs: 5_000,
      onTask: vi.fn(),
    });

    watcher.start();
    watcher.start(); // second call should be no-op

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5_000);

    // getProjects called twice — once for immediate poll, once for interval
    expect(client.getProjects).toHaveBeenCalledTimes(2);
    watcher.stop();
  });

  it("stop() when timer is already null does nothing", () => {
    const project = new Project(makeProjectSnapshot([]));
    const client = {
      provider: "linear" as const,
      getProjects: vi.fn(async () => [project]),
      getProject: vi.fn(),
      getTask: vi.fn(),
      initialize: vi.fn(async () => undefined),
    } as unknown as TaskListClient;
    const taskList = new TaskList(client);

    const watcher = new TaskWatcher(taskList, {
      project: "Bot",
      whenStatus: "Todo",
      moveTo: "In Progress",
      onTask: vi.fn(),
    });

    // stop before start — timer is null, should not throw
    expect(() => watcher.stop()).not.toThrow();
  });

  it("handleError falls back to console.error when no onError provided", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const project = new Project(
      makeProjectSnapshot(
        [baseTaskData],
        createMockContext({
          updateTask: vi.fn().mockRejectedValue(new Error("update failed")),
        })
      )
    );
    const client = {
      provider: "linear" as const,
      getProjects: vi.fn(async () => [project]),
      getProject: vi.fn(),
      getTask: vi.fn(),
      initialize: vi.fn(async () => undefined),
    } as unknown as TaskListClient;
    const taskList = new TaskList(client);

    const watcher = new TaskWatcher(taskList, {
      project: "Bot",
      whenStatus: "Todo",
      moveTo: "In Progress",
      onTask: vi.fn(),
      // no onError — exercises console.error fallback
    });

    watcher.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(consoleError).toHaveBeenCalledWith(
      "TaskWatcher failed:",
      "update failed"
    );
    watcher.stop();
    consoleError.mockRestore();
  });

  it("handleError wraps non-Error objects before passing to onError", async () => {
    const onError = vi.fn();
    const context = createMockContext({
      updateTask: vi.fn().mockRejectedValue("string error — not an Error"),
    });
    const project = new Project(makeProjectSnapshot([baseTaskData], context));
    const client = {
      provider: "linear" as const,
      getProjects: vi.fn(async () => [project]),
      getProject: vi.fn(),
      getTask: vi.fn(),
      initialize: vi.fn(async () => undefined),
    } as unknown as TaskListClient;
    const taskList = new TaskList(client);

    const watcher = new TaskWatcher(taskList, {
      project: "Bot",
      whenStatus: "Todo",
      moveTo: "In Progress",
      onTask: vi.fn(),
      onError,
    });

    watcher.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    watcher.stop();
  });

  it("poll() outer catch triggers handleError when project lookup fails", async () => {
    const onError = vi.fn();
    const client = {
      provider: "linear" as const,
      getProjects: vi.fn().mockRejectedValue(new Error("network error")),
      getProject: vi.fn(),
      getTask: vi.fn(),
      initialize: vi.fn(async () => undefined),
    } as unknown as TaskListClient;
    const taskList = new TaskList(client);

    const watcher = new TaskWatcher(taskList, {
      project: "Bot",
      whenStatus: "Todo",
      moveTo: "In Progress",
      onTask: vi.fn(),
      onError,
    });

    watcher.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    watcher.stop();
  });
});

// ---------------------------------------------------------------------------
// Project.ts — createTask with no statuses, updateTasks, findTask error
// ---------------------------------------------------------------------------

describe("Project additional coverage", () => {
  it("createTask uses statuses[0].id as default when no status provided", async () => {
    const context = createMockContext({
      createTask: vi.fn().mockResolvedValue(makeTaskSnapshot()),
    });
    const project = new Project(makeProjectSnapshot([], context));

    await project.createTask({ title: "No status task" });

    expect(context.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ statusId: "status-1" })
    );
  });

  it("createTask uses empty string when no statuses and no status provided", async () => {
    const context = createMockContext({
      createTask: vi.fn().mockResolvedValue(makeTaskSnapshot()),
    });
    const emptySnapshot: ProjectSnapshot = {
      info: { id: "p1", name: "Empty", url: "https://example.com/p1" },
      statuses: [],
      labels,
      tasks: [],
      context,
    };
    const project = new Project(emptySnapshot);

    await project.createTask({ title: "No status task" });

    expect(context.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ statusId: "" })
    );
  });

  it("createTask resolves priority via context.resolvePriority when provided", async () => {
    const context = createMockContext({
      createTask: vi.fn().mockResolvedValue(makeTaskSnapshot()),
      resolvePriority: vi.fn().mockReturnValue(2),
    });
    const project = new Project(makeProjectSnapshot([], context));

    await project.createTask({ title: "Urgent task", priority: "High" });

    expect(context.resolvePriority).toHaveBeenCalledWith("High");
    expect(context.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 2 })
    );
  });

  it("updateTasks returns updated tasks and count", async () => {
    const updatedSnapshot = makeTaskSnapshot({
      ...baseTaskData,
      statusId: "status-2",
    });
    const context = createMockContext({
      updateTask: vi.fn().mockResolvedValue(updatedSnapshot),
    });
    const project = new Project(makeProjectSnapshot([baseTaskData], context));

    const result = await project.updateTasks(
      { status: "Todo" },
      { status: "In Progress" }
    );

    expect(result.count).toBe(1);
    expect(result.updated).toHaveLength(1);
  });

  it("findTask throws TaskNotFoundError for unknown id", () => {
    const project = new Project(makeProjectSnapshot([baseTaskData]));

    expect(() => project.findTask("nonexistent-id")).toThrow(TaskNotFoundError);
  });

  it("findTask returns the task for a known id", () => {
    const project = new Project(makeProjectSnapshot([baseTaskData]));

    const task = project.findTask("task-1");
    expect(task.id).toBe("task-1");
  });

  it("refresh() calls context.fetchProject and updates state", async () => {
    const newSnapshot = makeProjectSnapshot([], createMockContext());
    const context = createMockContext({
      fetchProject: vi.fn().mockResolvedValue(newSnapshot),
    });
    const project = new Project(makeProjectSnapshot([baseTaskData], context));

    await project.refresh();

    expect(context.fetchProject).toHaveBeenCalledWith("project-1");
    expect(project.tasks()).toHaveLength(0);
  });

  it("createLabel calls context.createLabel with color when provided", async () => {
    const newLabel: Label = { id: "label-new", name: "Feature", color: "#0f0" };
    const refreshedSnapshot = makeProjectSnapshot([], createMockContext());
    const context = createMockContext({
      createLabel: vi.fn().mockResolvedValue(newLabel),
      fetchProject: vi.fn().mockResolvedValue(refreshedSnapshot),
    });
    const project = new Project(makeProjectSnapshot([], context));

    const result = await project.createLabel("Feature", { color: "#0f0" });

    expect(context.createLabel).toHaveBeenCalledWith("Feature", "#0f0");
    expect(result).toEqual(newLabel);
  });

  it("createLabel calls context.createLabel without color when not provided", async () => {
    const newLabel: Label = { id: "label-new", name: "Chore", color: "" };
    const refreshedSnapshot = makeProjectSnapshot([], createMockContext());
    const context = createMockContext({
      createLabel: vi.fn().mockResolvedValue(newLabel),
      fetchProject: vi.fn().mockResolvedValue(refreshedSnapshot),
    });
    const project = new Project(makeProjectSnapshot([], context));

    await project.createLabel("Chore");

    expect(context.createLabel).toHaveBeenCalledWith("Chore", undefined);
  });

  it("deleteLabel resolves label by name and calls context.deleteLabel", async () => {
    const refreshedSnapshot = makeProjectSnapshot([], createMockContext());
    const context = createMockContext({
      deleteLabel: vi.fn().mockResolvedValue(undefined),
      fetchProject: vi.fn().mockResolvedValue(refreshedSnapshot),
    });
    const project = new Project(makeProjectSnapshot([], context));

    await project.deleteLabel("Bug");

    expect(context.deleteLabel).toHaveBeenCalledWith("label-1");
  });

  it("deleteLabel throws LabelNotFoundError for unknown label", () => {
    const project = new Project(makeProjectSnapshot([]));

    expect(() => project.deleteLabel("NonExistent")).rejects.toBeInstanceOf(
      LabelNotFoundError
    );
  });
});

// ---------------------------------------------------------------------------
// Task.ts — update with empty status, tag label fallback, untag with remaining
// ---------------------------------------------------------------------------

describe("Task additional coverage", () => {
  it("update() skips statusId when status is empty string", async () => {
    const context = createMockContext({
      updateTask: vi.fn().mockResolvedValue(makeTaskSnapshot()),
    });
    const task = new Task(makeTaskSnapshot(baseTaskData, context));

    await task.update({ status: "" });

    expect(context.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ statusId: undefined })
    );
  });

  it("update() resolves priority when resolvePriority is provided", async () => {
    const context = createMockContext({
      updateTask: vi.fn().mockResolvedValue(makeTaskSnapshot()),
      resolvePriority: vi.fn().mockReturnValue(1),
    });
    const task = new Task(makeTaskSnapshot(baseTaskData, context));

    await task.update({ priority: "Urgent" });

    expect(context.resolvePriority).toHaveBeenCalledWith("Urgent");
    expect(context.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 1 })
    );
  });

  it("tag() uses labelName as fallback when label id not found in context.labels", async () => {
    // When resolveLabelId returns an id that doesn't exist in context.labels,
    // the fallback is to use labelName directly as the canonical label name.
    // Then update() calls resolveLabelId again on each label name.
    const context = createMockContext({
      resolveLabelId: vi.fn().mockReturnValue("unknown-id"),
      labels: [], // empty labels array — so no label.id will match "unknown-id"
      updateTask: vi.fn().mockResolvedValue(
        makeTaskSnapshot({
          ...baseTaskData,
          labels: [],
        })
      ),
    });
    const task = new Task(
      makeTaskSnapshot({ ...baseTaskData, labels: [] }, context)
    );

    await task.tag("NewLabel");

    // The fallback labelName "NewLabel" is added to nextLabels
    // then update() calls resolveLabelId("NewLabel") → "unknown-id"
    expect(context.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        labelIds: ["unknown-id"],
      })
    );
  });

  it("untag() filters out removed labels and keeps remaining ones", async () => {
    const taskWithTwoLabels: TaskData = {
      ...baseTaskData,
      labels: [labels[0]!, labels[1]!],
    };
    const context = createMockContext({
      resolveLabelId: vi.fn((name: string) =>
        name === "Bug" ? "label-1" : "label-2"
      ),
      updateTask: vi.fn().mockResolvedValue(makeTaskSnapshot()),
    });
    const task = new Task(makeTaskSnapshot(taskWithTwoLabels, context));

    await task.untag("Bug");

    // untag builds nextLabels from context.labels (minus toRemove), then calls update()
    // update() calls resolveLabelId("Feature") → "label-2"
    expect(context.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        labelIds: ["label-2"], // Feature's id remains after Bug is removed
      })
    );
  });

  it("refresh() calls context.fetchTask and applies new snapshot", async () => {
    const refreshedData: TaskData = {
      ...baseTaskData,
      title: "Updated title",
    };
    const context = createMockContext({
      fetchTask: vi.fn().mockResolvedValue(makeTaskSnapshot(refreshedData)),
    });
    const task = new Task(makeTaskSnapshot(baseTaskData, context));

    await task.refresh();

    expect(context.fetchTask).toHaveBeenCalledWith("task-1");
    expect(task.title).toBe("Updated title");
  });

  it("Task constructor uses undefined for priority when priority field is absent", () => {
    const taskDataNoPriority: TaskData = {
      id: "t-2",
      title: "No priority",
      description: "",
      statusId: "status-1",
      projectId: "p-1",
      labels: [],
      url: "https://example.com",
      // no priority field
    };
    const task = new Task(makeTaskSnapshot(taskDataNoPriority));
    expect(task.priority).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TaskList.ts — projectById
// ---------------------------------------------------------------------------

describe("TaskList.projectById", () => {
  it("calls client.getProject with the given id", async () => {
    const project = new Project(makeProjectSnapshot());
    const client = {
      provider: "linear" as const,
      getProjects: vi.fn(async () => [project]),
      getProject: vi.fn(async () => project),
      getTask: vi.fn(),
      initialize: vi.fn(async () => undefined),
    } as unknown as TaskListClient;
    const taskList = new TaskList(client);

    const result = await taskList.projectById("project-1");
    expect(result).toBe(project);
    expect(client.getProject).toHaveBeenCalledWith("project-1");
  });
});

// ---------------------------------------------------------------------------
// Linear context methods — extra branch coverage
// ---------------------------------------------------------------------------

describe("LinearTaskListClient context methods", () => {
  const mockFetch = vi.fn();

  function graphqlResponse(data: unknown) {
    return {
      ok: true,
      json: () => Promise.resolve({ data }),
    } as Response;
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeLinearClient() {
    return new LinearTaskListClient({
      provider: "linear",
      apiKey: "lin_test_key",
      teamId: "team-1",
    });
  }

  const teamData = {
    states: {
      nodes: [
        { id: "ws1", name: "Todo" },
        { id: "ws2", name: "In Progress" },
      ],
    },
    labels: {
      nodes: [
        { id: "ll1", name: "Bug", color: "#ff0000" },
        { id: "ll2", name: "Feature", color: "#00ff00" },
      ],
    },
  };

  const linearIssue = {
    id: "ISS-1",
    title: "Fix login",
    description: "Users cannot log in",
    url: "https://linear.app/team/ISS-1",
    priority: 2,
    state: { id: "ws1" },
    team: { id: "team-1" },
    project: { id: "proj-1" },
    labels: { nodes: [{ id: "ll1", name: "Bug", color: "#ff0000" }] },
  };

  it("createTask without optional description, labels, priority", async () => {
    // First get a project to get context
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issueCreate: { issue: linearIssue } })
    );

    const client = makeLinearClient();
    const project = await client.getProject("proj-1");
    const task = await project.createTask({ title: "Minimal task" });

    expect(task.title).toBe("Fix login");
    const body = JSON.parse(
      (mockFetch.mock.calls[1]![1] as RequestInit).body as string
    ) as { variables: { input: Record<string, unknown> } };
    expect(body.variables.input.description).toBeUndefined();
    expect(body.variables.input.labelIds).toBeUndefined();
    expect(body.variables.input.priority).toBeUndefined();
  });

  it("updateTask without optional fields (empty input)", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issue: linearIssue, team: teamData })
    );
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        issueUpdate: { issue: linearIssue },
      })
    );

    const client = makeLinearClient();
    const task = await client.getTask("ISS-1");
    // update with no fields
    await task.update({});

    const body = JSON.parse(
      (mockFetch.mock.calls[1]![1] as RequestInit).body as string
    ) as { variables: { input: Record<string, unknown> } };
    // All optional fields should be absent
    expect(body.variables.input).toEqual({});
  });

  it("updateTask with title and description (covers those optional branches)", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issue: linearIssue, team: teamData })
    );
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        issueUpdate: {
          issue: {
            ...linearIssue,
            title: "New title",
            description: "New desc",
          },
        },
      })
    );

    const client = makeLinearClient();
    const task = await client.getTask("ISS-1");
    await task.update({ title: "New title", description: "New desc" });

    const body = JSON.parse(
      (mockFetch.mock.calls[1]![1] as RequestInit).body as string
    ) as { variables: { input: Record<string, unknown> } };
    expect(body.variables.input.title).toBe("New title");
    expect(body.variables.input.description).toBe("New desc");
  });

  it("updateTask with priority (covers priority branch)", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issue: linearIssue, team: teamData })
    );
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        issueUpdate: {
          issue: { ...linearIssue, priority: 1 },
        },
      })
    );

    const client = makeLinearClient();
    const task = await client.getTask("ISS-1");
    await task.update({ priority: "Urgent" });

    const body = JSON.parse(
      (mockFetch.mock.calls[1]![1] as RequestInit).body as string
    ) as { variables: { input: Record<string, unknown> } };
    expect(body.variables.input.priority).toBe(1);
  });

  it("getProjects() returns projects with tasks", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        team: {
          projects: {
            nodes: [
              {
                id: "proj-1",
                name: "Q1 Roadmap",
                url: "https://linear.app/proj-1",
                issues: { nodes: [linearIssue] },
              },
            ],
          },
          states: teamData.states,
          labels: teamData.labels,
        },
      })
    );

    const client = makeLinearClient();
    const projects = await client.getProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]!.name).toBe("Q1 Roadmap");
    expect(projects[0]!.tasks()).toHaveLength(1);
  });

  it("createLabel with color", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        issueLabelCreate: {
          issueLabel: { id: "lbl-new", name: "Feature", color: "#0f0" },
        },
      })
    );
    // fetchProject for refresh after createLabel
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );

    const client = makeLinearClient();
    const project = await client.getProject("proj-1");
    const label = await project.createLabel("Feature", { color: "#0f0" });

    expect(label.name).toBe("Feature");
    expect(label.color).toBe("#0f0");
  });

  it("createLabel without color", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        issueLabelCreate: {
          issueLabel: { id: "lbl-new", name: "Chore", color: "" },
        },
      })
    );
    // fetchProject for refresh
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );

    const client = makeLinearClient();
    const project = await client.getProject("proj-1");
    const label = await project.createLabel("Chore");

    expect(label.name).toBe("Chore");
    const body = JSON.parse(
      (mockFetch.mock.calls[1]![1] as RequestInit).body as string
    ) as { variables: { input: Record<string, unknown> } };
    expect(body.variables.input.color).toBeUndefined();
  });

  it("deleteLabel sends delete mutation", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issueLabelDelete: { success: true } })
    );
    // fetchProject for refresh
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );

    const client = makeLinearClient();
    const project = await client.getProject("proj-1");
    await project.deleteLabel("Bug");

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("teamResolutionPromise is reused for concurrent resolveTeam() calls", async () => {
    // Two concurrent calls to resolveTeam() should only make one network request
    const noTeamClient = new LinearTaskListClient({
      provider: "linear",
      apiKey: "lin_test_key",
      // no teamId — must resolve
    });

    let resolveTeams!: (value: unknown) => void;
    // First call blocks until we resolve
    mockFetch.mockReturnValueOnce(
      new Promise((res) => {
        resolveTeams = res;
      })
    );

    // Start two concurrent resolveTeam calls
    const p1 = noTeamClient.resolveTeam();
    const p2 = noTeamClient.resolveTeam(); // should reuse the promise

    // Now resolve the pending fetch
    resolveTeams({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { teams: { nodes: [{ id: "t-1", name: "Core" }] } },
        }),
    });

    await Promise.all([p1, p2]);

    // Only one fetch call despite two resolveTeam() calls
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("resolvePriority throws InvalidPriorityError for unknown priority", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );

    const client = makeLinearClient();
    const project = await client.getProject("proj-1");

    await expect(
      project.createTask({ title: "Test", priority: "SuperHigh" as never })
    ).rejects.toBeInstanceOf(InvalidPriorityError);
  });

  it("context.fetchTask calls fetchTaskSnapshot", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );
    // fetchTaskSnapshot for refresh
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issue: linearIssue, team: teamData })
    );

    const client = makeLinearClient();
    const project = await client.getProject("proj-1");
    // Manually create a Task with the context from this project to test fetchTask
    const context = (project as unknown as { context: TaskContext }).context;
    const snapshot = await context.fetchTask("ISS-1");

    expect(snapshot.task.id).toBe("ISS-1");
  });

  it("context.fetchProject calls fetchProjectSnapshot", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );
    // fetchProjectSnapshot for fetchProject
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: {
          id: "proj-1",
          name: "Q1 Roadmap",
          url: "https://linear.app",
          issues: { nodes: [] },
        },
        team: teamData,
      })
    );

    const client = makeLinearClient();
    const project = await client.getProject("proj-1");
    const context = (project as unknown as { context: TaskContext }).context;
    const snapshot = await context.fetchProject("proj-1");

    expect(snapshot.info.id).toBe("proj-1");
  });
});

// ---------------------------------------------------------------------------
// Trello context methods — extra branch coverage
// ---------------------------------------------------------------------------

describe("TrelloTaskListClient context methods", () => {
  const mockFetch = vi.fn();

  function jsonResponse(data: unknown) {
    return { ok: true, json: () => Promise.resolve(data) } as Response;
  }

  const trelloBoard = {
    id: "board-1",
    name: "My Board",
    url: "https://trello.com/b/board-1",
  };
  const trelloLists = [
    { id: "list-1", name: "Todo", idBoard: "board-1" },
    { id: "list-2", name: "Done", idBoard: "board-1" },
  ];
  const trelloLabel = { id: "label-1", name: "Bug", color: "red" };
  const trelloCard = {
    id: "card-1",
    name: "Fix bug",
    desc: "A description",
    idList: "list-1",
    idBoard: "board-1",
    idLabels: ["label-1"],
    labels: [trelloLabel],
    url: "https://trello.com/c/card-1",
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeClient() {
    return new TrelloTaskListClient({
      provider: "trello",
      apiKey: "test-key",
      token: "test-token",
    });
  }

  it("updateTask without title (only status change)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...trelloCard, idList: "list-2" })
    );

    const client = makeClient();
    const project = await client.getProject("board-1");
    const task = project.tasks()[0]!;
    await task.update({ status: "Done" });

    const body = JSON.parse(
      (mockFetch.mock.calls.at(-1)![1] as RequestInit).body as string
    ) as Record<string, string>;
    expect(body["name"]).toBeUndefined();
    expect(body["idList"]).toBe("list-2");
  });

  it("updateTask with description and labels (covers those optional branches)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...trelloCard, desc: "New desc", idLabels: ["label-1"] })
    );

    const client = makeClient();
    const project = await client.getProject("board-1");
    const task = project.tasks()[0]!;
    await task.update({ description: "New desc", labels: ["Bug"] });

    const body = JSON.parse(
      (mockFetch.mock.calls.at(-1)![1] as RequestInit).body as string
    ) as Record<string, string>;
    expect(body["desc"]).toBe("New desc");
    expect(body["idLabels"]).toBe("label-1");
  });

  it("createTask without description and without labels", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...trelloCard, id: "card-new", name: "Minimal" })
    );

    const client = makeClient();
    const project = await client.getProject("board-1");
    const task = await project.createTask({
      title: "Minimal",
      status: "Todo",
    });

    expect(task.title).toBe("Minimal");
    const body = JSON.parse(
      (mockFetch.mock.calls.at(-1)![1] as RequestInit).body as string
    ) as Record<string, string>;
    expect(body["desc"]).toBeUndefined();
    expect(body["idLabels"]).toBeUndefined();
  });

  it("createLabel with color", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // createLabel POST
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: "lbl-new", name: "Feature", color: "blue" })
    );
    // fetchProject for refresh
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const client = makeClient();
    const project = await client.getProject("board-1");
    const label = await project.createLabel("Feature", { color: "blue" });

    expect(label.name).toBe("Feature");
    const body = JSON.parse(
      (mockFetch.mock.calls[4]![1] as RequestInit).body as string
    ) as Record<string, string>;
    expect(body["color"]).toBe("blue");
  });

  it("createLabel without color", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // createLabel POST
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: "lbl-new", name: "Chore", color: "" })
    );
    // fetchProject for refresh
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const client = makeClient();
    const project = await client.getProject("board-1");
    const label = await project.createLabel("Chore");

    expect(label.name).toBe("Chore");
    const body = JSON.parse(
      (mockFetch.mock.calls[4]![1] as RequestInit).body as string
    ) as Record<string, string>;
    expect(body["color"]).toBeUndefined();
  });

  it("deleteLabel sends DELETE request", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // deleteLabel
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    // fetchProject for refresh
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const client = makeClient();
    const project = await client.getProject("board-1");
    await project.deleteLabel("Bug");

    const deleteCall = mockFetch.mock.calls[4]!;
    expect((deleteCall[1] as RequestInit).method).toBe("DELETE");
  });

  it("context.fetchTask calls fetchTaskSnapshot", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // fetchTaskSnapshot: card + lists + labels
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const client = makeClient();
    const project = await client.getProject("board-1");
    const context = (project as unknown as { context: TaskContext }).context;
    const snapshot = await context.fetchTask("card-1");

    expect(snapshot.task.id).toBe("card-1");
  });

  it("context.fetchProject calls fetchProjectSnapshot", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // fetchProjectSnapshot
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const client = makeClient();
    const project = await client.getProject("board-1");
    const context = (project as unknown as { context: TaskContext }).context;
    const snapshot = await context.fetchProject("board-1");

    expect(snapshot.info.id).toBe("board-1");
  });

  it("TrelloTaskListClient throws when apiKey and token are missing", () => {
    const savedKey = process.env.TRELLO_API_KEY;
    const savedToken = process.env.TRELLO_API_TOKEN;
    delete process.env.TRELLO_API_KEY;
    delete process.env.TRELLO_API_TOKEN;

    try {
      const client = new TrelloTaskListClient({
        provider: "trello",
        // no apiKey, no token, no env vars
      });
      // initialize() calls assertConfigured() synchronously which throws
      expect(() => client.initialize()).toThrow(
        TaskListProviderNotConfiguredError
      );
    } finally {
      if (savedKey !== undefined) process.env.TRELLO_API_KEY = savedKey;
      if (savedToken !== undefined) process.env.TRELLO_API_TOKEN = savedToken;
    }
  });
});
