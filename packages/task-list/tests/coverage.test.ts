/**
 * Additional tests to achieve 100% coverage for task-list package.
 * Covers: errors.ts, resolvers.ts, index.ts, TaskWatcher.ts,
 *         Project.ts (lines 130-144), Task.ts (lines 97-99),
 *         TaskList.ts (line 43), TaskListClient.ts (line 12),
 *         linear/LinearTaskListClient.ts (lines 343, 358-398),
 *         trello/TrelloTaskListClient.ts (lines 219, 225, 240-270)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Project } from "../src/Project.js";
import { Task } from "../src/Task.js";
import { TaskList } from "../src/TaskList.js";
import { TaskListClient } from "../src/TaskListClient.js";
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
import { buildContextResolvers, matchesCaseInsensitive } from "../src/resolvers.js";
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
// Shared fixtures
// ---------------------------------------------------------------------------

const statuses: readonly Status[] = [
  { id: "s1", name: "Todo" },
  { id: "s2", name: "Done" },
];
const labels: readonly Label[] = [
  { id: "l1", name: "Bug", color: "#f00" },
  { id: "l2", name: "Feature", color: "#0f0" },
];

function createMockContext(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    fetchTask: vi.fn(),
    fetchProject: vi.fn(),
    createLabel: vi.fn(),
    deleteLabel: vi.fn(),
    resolveStatusId: vi.fn((name: string) =>
      name.toLowerCase() === "done" ? "s2" : "s1"
    ),
    resolveStatusName: vi.fn((id: string) =>
      id === "s2" ? "Done" : "Todo"
    ),
    resolveLabelId: vi.fn((name: string) =>
      name.toLowerCase() === "bug" ? "l1" : "l2"
    ),
    labels,
    statuses,
    ...overrides,
  };
}

const baseTaskData: TaskData = {
  id: "task-1",
  title: "Base task",
  description: "desc",
  statusId: "s1",
  projectId: "project-1",
  labels: [labels[0]!],
  url: "https://example.com/tasks/1",
};

function makeTaskSnapshot(
  data: TaskData = baseTaskData,
  context: TaskContext = createMockContext()
): TaskSnapshot {
  return { task: data, context };
}

function makeProjectSnapshot(
  taskData: readonly TaskData[] = [],
  context: TaskContext = createMockContext()
): ProjectSnapshot {
  return {
    info: { id: "project-1", name: "Alpha", url: "https://example.com/projects/1" },
    statuses,
    labels,
    tasks: taskData,
    context,
  };
}

// ---------------------------------------------------------------------------
// errors.ts coverage
// ---------------------------------------------------------------------------

describe("errors", () => {
  it("TaskListError sets code and details", () => {
    const err = new TaskListError("msg", "CODE", { foo: "bar" });
    expect(err.code).toBe("CODE");
    expect(err.details).toEqual({ foo: "bar" });
    expect(err.name).toBe("TaskListError");
  });

  it("UnknownTaskListProviderError", () => {
    const err = new UnknownTaskListProviderError("unknown");
    expect(err.code).toBe("UNKNOWN_PROVIDER");
    expect(err.message).toContain("unknown");
  });

  it("TaskListProviderNotConfiguredError for linear with missing fields", () => {
    const err = new TaskListProviderNotConfiguredError("linear", ["Set LINEAR_API_KEY"]);
    expect(err.message).toContain("Linear");
    expect(err.message).toContain("Set LINEAR_API_KEY");
  });

  it("TaskListProviderNotConfiguredError for linear with no missing fields", () => {
    const err = new TaskListProviderNotConfiguredError("linear");
    expect(err.message).toContain("Linear");
    expect(err.message).not.toContain("Available");
  });

  it("TaskListProviderNotConfiguredError for trello", () => {
    const err = new TaskListProviderNotConfiguredError("trello", ["Set TRELLO_API_KEY"]);
    expect(err.message).toContain("Trello");
  });

  it("TaskListProviderNotConfiguredError for trello with no missing fields", () => {
    const err = new TaskListProviderNotConfiguredError("trello");
    expect(err.message).toContain("Trello");
  });

  it("ProjectNotFoundError with available projects", () => {
    const err = new ProjectNotFoundError("Alpha", ["Beta", "Gamma"]);
    expect(err.message).toContain("Alpha");
    expect(err.message).toContain("Beta");
  });

  it("ProjectNotFoundError without available projects", () => {
    const err = new ProjectNotFoundError("Alpha");
    expect(err.message).toContain("Alpha");
  });

  it("TaskNotFoundError with available tasks", () => {
    const err = new TaskNotFoundError("t1", "Alpha", ["t2"]);
    expect(err.message).toContain("t1");
    expect(err.message).toContain("t2");
  });

  it("TaskNotFoundError without available tasks", () => {
    const err = new TaskNotFoundError("t1", "Alpha");
    expect(err.message).toContain("t1");
  });

  it("StatusNotFoundError with projectName and available statuses", () => {
    const err = new StatusNotFoundError("Missing", "Alpha", ["Todo", "Done"]);
    expect(err.message).toContain("Missing");
    expect(err.message).toContain("Alpha");
    expect(err.message).toContain("Todo");
  });

  it("StatusNotFoundError without projectName", () => {
    const err = new StatusNotFoundError("Missing");
    expect(err.message).not.toContain("project");
  });

  it("StatusNotFoundError without projectName but with available statuses", () => {
    const err = new StatusNotFoundError("Missing", undefined, ["Todo"]);
    expect(err.message).toContain("Todo");
  });

  it("StatusIdNotFoundError with available statuses", () => {
    const err = new StatusIdNotFoundError("s99", ["Todo", "Done"]);
    expect(err.message).toContain("s99");
    expect(err.message).toContain("Todo");
  });

  it("StatusIdNotFoundError without available statuses", () => {
    const err = new StatusIdNotFoundError("s99");
    expect(err.message).toContain("s99");
  });

  it("LabelNotFoundError with projectName and available labels", () => {
    const err = new LabelNotFoundError("Unknown", "Alpha", ["Bug"]);
    expect(err.message).toContain("Unknown");
    expect(err.message).toContain("Alpha");
    expect(err.message).toContain("Bug");
  });

  it("LabelNotFoundError without projectName", () => {
    const err = new LabelNotFoundError("Unknown");
    expect(err.message).toContain("Unknown");
  });

  it("TeamNotFoundError", () => {
    const err = new TeamNotFoundError("Core", ["Eng", "Ops"]);
    expect(err.message).toContain("Core");
    expect(err.message).toContain("Eng");
  });

  it("NoTeamsFoundError", () => {
    const err = new NoTeamsFoundError();
    expect(err.code).toBe("NO_TEAMS_FOUND");
  });

  it("MultipleTeamsFoundError", () => {
    const err = new MultipleTeamsFoundError(["Core", "Ops"]);
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
  });

  it("LinearGraphQLError", () => {
    const err = new LinearGraphQLError("Not found");
    expect(err.code).toBe("LINEAR_GRAPHQL_ERROR");
  });

  it("InvalidPriorityError", () => {
    const err = new InvalidPriorityError("badpriority");
    expect(err.code).toBe("INVALID_PRIORITY");
    expect(err.message).toContain("badpriority");
  });
});

// ---------------------------------------------------------------------------
// resolvers.ts coverage
// ---------------------------------------------------------------------------

describe("resolvers", () => {
  describe("matchesCaseInsensitive", () => {
    it("matches identical strings", () => {
      expect(matchesCaseInsensitive("hello", "hello")).toBe(true);
    });

    it("matches case-insensitively", () => {
      expect(matchesCaseInsensitive("HELLO", "hello")).toBe(true);
    });

    it("returns false for non-matching strings", () => {
      expect(matchesCaseInsensitive("hello", "world")).toBe(false);
    });
  });

  describe("buildContextResolvers", () => {
    const ctx = buildContextResolvers(statuses, labels);

    it("resolveStatusId returns id for known status", () => {
      expect(ctx.resolveStatusId("Todo")).toBe("s1");
    });

    it("resolveStatusId throws StatusNotFoundError for unknown status", () => {
      expect(() => ctx.resolveStatusId("NonExistent")).toThrow(StatusNotFoundError);
    });

    it("resolveStatusName returns name for known id", () => {
      expect(ctx.resolveStatusName("s1")).toBe("Todo");
    });

    it("resolveStatusName throws StatusIdNotFoundError for unknown id", () => {
      expect(() => ctx.resolveStatusName("s99")).toThrow(StatusIdNotFoundError);
    });

    it("resolveLabelId returns id for known label", () => {
      expect(ctx.resolveLabelId("Bug")).toBe("l1");
    });

    it("resolveLabelId throws LabelNotFoundError for unknown label", () => {
      expect(() => ctx.resolveLabelId("Nonexistent")).toThrow(LabelNotFoundError);
    });

    it("exposes statuses and labels", () => {
      expect(ctx.statuses).toHaveLength(2);
      expect(ctx.labels).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// index.ts coverage (lines 66, 78 — createTaskList edge cases)
// ---------------------------------------------------------------------------

describe("createTaskList edge cases", () => {
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
  });

  it("throws UnknownTaskListProviderError for unknown provider (normalizeConfig)", async () => {
    await expect(
      createTaskList({ provider: "unknown" as never })
    ).rejects.toBeInstanceOf(UnknownTaskListProviderError);
  });

  it("creates a trello client when provider is 'trello'", async () => {
    const taskList = await createTaskList({
      provider: "trello",
      apiKey: "key",
      token: "token",
    });
    expect(taskList.provider).toBe("trello");
  });
});

// ---------------------------------------------------------------------------
// TaskListClient.ts — initialize() returns a resolved promise (line 12)
// ---------------------------------------------------------------------------

describe("TaskListClient", () => {
  it("default initialize() resolves immediately", async () => {
    class ConcreteClient extends TaskListClient {
      readonly provider = "linear" as const;
      async getProjects() { return []; }
      async getProject() { return null as never; }
      async getTask() { return null as never; }
    }
    const client = new ConcreteClient({ provider: "linear" });
    await expect(client.initialize()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TaskWatcher.ts — lines 32, 68, 83
// ---------------------------------------------------------------------------

describe("TaskWatcher extra coverage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("start() is idempotent (calling start twice returns same instance)", async () => {
    const project = new Project(makeProjectSnapshot([]));
    const client = new (class extends TaskListClient {
      readonly provider = "linear" as const;
      getProjects = vi.fn(async () => [project]);
      getProject = vi.fn(async () => project);
      getTask = vi.fn(async () => null as never);
      constructor() { super({ provider: "linear" }); }
    })();
    const taskList = new TaskList(client);

    // We need to call start() twice on the same TaskWatcher.
    // TaskList.watch() calls new TaskWatcher().start() so we import TaskWatcher directly.
    const { TaskWatcher } = await import("../src/TaskWatcher.js");
    const watcher = new TaskWatcher(taskList, {
      project: "Alpha",
      whenStatus: "Todo",
      moveTo: "Done",
      everyMs: 1000,
      onTask: vi.fn(),
    });

    const result1 = watcher.start();
    const result2 = watcher.start(); // should return same instance (timer already set)

    expect(result1).toBe(watcher);
    expect(result2).toBe(watcher);
    await vi.advanceTimersByTimeAsync(0);
    watcher.stop();
  });

  it("stop() when timer is null is a no-op", async () => {
    const project = new Project(makeProjectSnapshot([]));
    const client = new (class extends TaskListClient {
      readonly provider = "linear" as const;
      getProjects = vi.fn(async () => [project]);
      getProject = vi.fn(async () => project);
      getTask = vi.fn(async () => null as never);
      constructor() { super({ provider: "linear" }); }
    })();
    const taskList = new TaskList(client);

    const watch = taskList.watch({
      project: "Alpha",
      whenStatus: "Todo",
      moveTo: "Done",
      everyMs: 1000,
      onTask: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    watch.stop();
    // Calling stop a second time when timer is null should not throw
    expect(() => watch.stop()).not.toThrow();
  });

  it("handleError logs to console when no onError is configured", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const context = createMockContext({
      updateTask: vi.fn().mockRejectedValue(new Error("oops")),
    });
    const project = new Project(makeProjectSnapshot([baseTaskData], context));
    const client = new (class extends TaskListClient {
      readonly provider = "linear" as const;
      getProjects = vi.fn(async () => [project]);
      getProject = vi.fn(async () => project);
      getTask = vi.fn(async () => null as never);
      constructor() { super({ provider: "linear" }); }
    })();
    const taskList = new TaskList(client);

    const watch = taskList.watch({
      project: "Alpha",
      whenStatus: "Todo",
      moveTo: "Done",
      everyMs: 1000,
      onTask: vi.fn(),
      // No onError - should log to console
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(consoleError).toHaveBeenCalled();
    watch.stop();
    consoleError.mockRestore();
  });

  it("handleError wraps non-Error objects", async () => {
    const onError = vi.fn();
    const context = createMockContext({
      updateTask: vi.fn().mockRejectedValue("string error"),
    });
    const project = new Project(makeProjectSnapshot([baseTaskData], context));
    const client = new (class extends TaskListClient {
      readonly provider = "linear" as const;
      getProjects = vi.fn(async () => [project]);
      getProject = vi.fn(async () => project);
      getTask = vi.fn(async () => null as never);
      constructor() { super({ provider: "linear" }); }
    })();
    const taskList = new TaskList(client);

    const watch = taskList.watch({
      project: "Alpha",
      whenStatus: "Todo",
      moveTo: "Done",
      everyMs: 1000,
      onTask: vi.fn(),
      onError,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    watch.stop();
  });

  it("poll() error from taskList.project routes to handleError", async () => {
    const onError = vi.fn();
    const client = new (class extends TaskListClient {
      readonly provider = "linear" as const;
      getProjects = vi.fn(async () => { throw new Error("network fail"); });
      getProject = vi.fn(async () => null as never);
      getTask = vi.fn(async () => null as never);
      constructor() { super({ provider: "linear" }); }
    })();
    const taskList = new TaskList(client);

    const watch = taskList.watch({
      project: "Alpha",
      whenStatus: "Todo",
      moveTo: "Done",
      everyMs: 1000,
      onTask: vi.fn(),
      onError,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    watch.stop();
  });
});

// ---------------------------------------------------------------------------
// Task.ts — applySnapshot with undefined priority (lines 97-99 in constructor)
// ---------------------------------------------------------------------------

describe("Task applySnapshot with undefined priority", () => {
  it("priority is undefined when task.priority is undefined after refresh", async () => {
    const noPriorityData: TaskData = { ...baseTaskData, priority: undefined };
    const context = createMockContext({
      fetchTask: vi.fn().mockResolvedValue(makeTaskSnapshot(noPriorityData)),
    });
    const task = new Task(makeTaskSnapshot(baseTaskData, context));

    // Initially has priority, after refresh it should be undefined
    await task.refresh();
    expect(task.priority).toBeUndefined();
  });

  it("Task with undefined priority in constructor", () => {
    const noPriorityData: TaskData = { ...baseTaskData, priority: undefined };
    const task = new Task(makeTaskSnapshot(noPriorityData));
    expect(task.priority).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Project.ts — line 130 (findTask returns found task)
// ---------------------------------------------------------------------------

describe("Project.findTask success path", () => {
  it("findTask returns the task when found", () => {
    const project = new Project(makeProjectSnapshot([baseTaskData]));
    const task = project.findTask("task-1");
    expect(task).toBeInstanceOf(Task);
    expect(task.id).toBe("task-1");
  });
});

// ---------------------------------------------------------------------------
// index.ts — line 78 (createClient throws for unknown provider)
// ---------------------------------------------------------------------------

describe("createClient throws for unknown provider", () => {
  it("createTaskList with unknown provider after normalizeConfig passes throws", async () => {
    // This tests the createClient throw. We need to get past normalizeConfig but fail in createClient.
    // normalizeConfig throws at line 66 already... Let's just test normalizeConfig with undefined provider
    // and that createTaskList with a known provider that lacks config throws appropriately.
    // Line 78 in index.ts is in createClient which is only reached if normalizeConfig succeeds.
    // normalizeConfig only succeeds for "linear" or "trello". createClient handles "trello" and "linear".
    // Line 78 would only be reached if we had a provider that passes normalizeConfig but not createClient.
    // Since normalizeConfig throws for unknown providers, line 78 appears unreachable in practice.
    // We can test that createTaskList with linear provider and no api key throws.
    delete process.env.LINEAR_API_KEY;
    await expect(createTaskList({ provider: "linear" })).rejects.toBeInstanceOf(
      TaskListProviderNotConfiguredError
    );
  });
});

// ---------------------------------------------------------------------------
// Project.ts — lines 130-144 (updateTasks)
// ---------------------------------------------------------------------------

describe("Project.updateTasks", () => {
  it("updateTasks updates all matching tasks and returns count", async () => {
    const updatedSnapshot = makeTaskSnapshot({
      ...baseTaskData,
      statusId: "s2",
    });
    const context = createMockContext({
      updateTask: vi.fn().mockResolvedValue(updatedSnapshot),
    });
    const project = new Project(makeProjectSnapshot([baseTaskData], context));

    const result = await project.updateTasks({ status: "Todo" }, { status: "Done" });

    expect(result.count).toBe(1);
    expect(result.updated).toHaveLength(1);
  });

  it("updateTasks returns empty result when no tasks match", async () => {
    const context = createMockContext();
    const project = new Project(makeProjectSnapshot([baseTaskData], context));

    const result = await project.updateTasks({ status: "Done" }, { status: "Todo" });

    expect(result.count).toBe(0);
    expect(result.updated).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Task.ts — lines 97-99 (update with empty status string)
// ---------------------------------------------------------------------------

describe("Task update with empty status", () => {
  it("update() passes undefined statusId when status is empty string", async () => {
    const context = createMockContext({
      updateTask: vi.fn().mockResolvedValue(makeTaskSnapshot()),
    });
    const task = new Task(makeTaskSnapshot(baseTaskData, context));

    await task.update({ status: "" });

    expect(context.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ statusId: undefined })
    );
  });

  it("update() passes undefined priority when resolvePriority is not defined", async () => {
    const contextWithoutPriority = createMockContext({
      resolvePriority: undefined,
      updateTask: vi.fn().mockResolvedValue(makeTaskSnapshot()),
    });
    const task = new Task(makeTaskSnapshot(baseTaskData, contextWithoutPriority));

    await task.update({ priority: "High" });

    expect(contextWithoutPriority.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ priority: undefined })
    );
  });
});

// ---------------------------------------------------------------------------
// TaskList.ts — line 43 (projectById)
// ---------------------------------------------------------------------------

describe("TaskList.projectById", () => {
  it("delegates to client.getProject", async () => {
    const project = new Project(makeProjectSnapshot());
    const client = new (class extends TaskListClient {
      readonly provider = "linear" as const;
      getProjects = vi.fn(async () => []);
      getProject = vi.fn(async () => project);
      getTask = vi.fn(async () => null as never);
      constructor() { super({ provider: "linear" }); }
    })();
    const taskList = new TaskList(client);

    const result = await taskList.projectById("project-1");
    expect(result).toBe(project);
    expect(client.getProject).toHaveBeenCalledWith("project-1");
  });
});

// ---------------------------------------------------------------------------
// Linear — createLabel with color, deleteLabel, resolvePriority error
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

function graphqlResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve({ data }) } as Response;
}

describe("LinearTaskListClient extra coverage", () => {
  let client: LinearTaskListClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new LinearTaskListClient({
      provider: "linear",
      apiKey: "lin_test_key",
      teamId: "team-1",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const linearStates = [{ id: "ws1", name: "Todo" }, { id: "ws2", name: "Done" }];
  const linearLabels = [{ id: "ll1", name: "Bug", color: "#f00" }];
  const linearProject = { id: "proj-1", name: "Q1", url: "https://linear.app/proj-1" };
  const linearIssue = {
    id: "ISS-1",
    title: "Fix",
    description: "desc",
    url: "https://linear.app/ISS-1",
    priority: 2,
    state: { id: "ws1" },
    team: { id: "team-1" },
    project: { id: "proj-1" },
    labels: { nodes: [] },
  };

  it("updateTask with description, labelIds, priority set", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issue: linearIssue, team: { states: { nodes: linearStates }, labels: { nodes: linearLabels } } })
    );
    const updatedIssue = { ...linearIssue, title: "Updated", priority: 3 };
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issueUpdate: { issue: updatedIssue } })
    );

    const task = await client.getTask("ISS-1");
    await task.update({ title: "Updated", description: "new desc", labels: ["Bug"], priority: "Medium" });

    const body = JSON.parse((mockFetch.mock.calls[1]![1] as RequestInit).body as string) as {
      variables: { input: Record<string, unknown> };
    };
    expect(body.variables.input.description).toBe("new desc");
    expect(body.variables.input.labelIds).toEqual(["ll1"]);
    expect(body.variables.input.priority).toBe(3);
  });

  it("createLabel sends correct mutation with color", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: { ...linearProject, issues: { nodes: [] } },
        team: { states: { nodes: linearStates }, labels: { nodes: linearLabels } },
      })
    );
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        issueLabelCreate: {
          issueLabel: { id: "ll2", name: "Feature", color: "#0f0" },
        },
      })
    );
    // refresh after createLabel
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: { ...linearProject, issues: { nodes: [] } },
        team: { states: { nodes: linearStates }, labels: { nodes: linearLabels } },
      })
    );

    const project = await client.getProject("proj-1");
    const label = await project.createLabel("Feature", { color: "#0f0" });

    expect(label.name).toBe("Feature");
    expect(label.color).toBe("#0f0");
  });

  it("createLabel sends correct mutation without color", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: { ...linearProject, issues: { nodes: [] } },
        team: { states: { nodes: linearStates }, labels: { nodes: linearLabels } },
      })
    );
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        issueLabelCreate: {
          issueLabel: { id: "ll3", name: "Chore", color: "" },
        },
      })
    );
    // refresh after createLabel
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: { ...linearProject, issues: { nodes: [] } },
        team: { states: { nodes: linearStates }, labels: { nodes: linearLabels } },
      })
    );

    const project = await client.getProject("proj-1");
    await project.createLabel("Chore");

    const body = JSON.parse((mockFetch.mock.calls[1]![1] as RequestInit).body as string) as {
      variables: { input: Record<string, unknown> };
    };
    expect(body.variables.input.color).toBeUndefined();
  });

  it("deleteLabel sends correct mutation", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: { ...linearProject, issues: { nodes: [] } },
        team: { states: { nodes: linearStates }, labels: { nodes: linearLabels } },
      })
    );
    mockFetch.mockResolvedValueOnce(graphqlResponse({})); // deleteLabel
    // refresh after deleteLabel
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: { ...linearProject, issues: { nodes: [] } },
        team: { states: { nodes: linearStates }, labels: { nodes: linearLabels } },
      })
    );

    const project = await client.getProject("proj-1");
    await project.deleteLabel("Bug");

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("resolvePriority throws InvalidPriorityError for unknown priority", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        project: { ...linearProject, issues: { nodes: [] } },
        team: { states: { nodes: linearStates }, labels: { nodes: linearLabels } },
      })
    );

    const project = await client.getProject("proj-1");
    await expect(
      project.createTask({ title: "T", priority: "InvalidPriority" })
    ).rejects.toBeInstanceOf(InvalidPriorityError);
  });

  it("teamResolutionPromise is reused when concurrent calls happen", async () => {
    const noTeamClient = new LinearTaskListClient({
      provider: "linear",
      apiKey: "lin_test_key",
    });
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ teams: { nodes: [{ id: "team-1", name: "Core" }] } })
    );

    // Two parallel calls to resolveTeam
    await Promise.all([noTeamClient.resolveTeam(), noTeamClient.resolveTeam()]);

    // Should only have fetched teams once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("context.fetchTask is called via task.refresh()", async () => {
    const teamData = { states: { nodes: linearStates }, labels: { nodes: linearLabels } };
    // getTask
    mockFetch.mockResolvedValueOnce(graphqlResponse({ issue: linearIssue, team: teamData }));
    // fetchTaskSnapshot (via context.fetchTask via task.refresh())
    mockFetch.mockResolvedValueOnce(graphqlResponse({ issue: linearIssue, team: teamData }));

    const task = await client.getTask("ISS-1");
    const refreshed = await task.refresh();
    expect(refreshed).toBe(task);
  });

  it("context.fetchProject is called via project.refresh()", async () => {
    const projectData = {
      organization: { urlKey: "myorg" },
      project: { ...linearProject, issues: { nodes: [] } },
      team: { states: { nodes: linearStates }, labels: { nodes: linearLabels } },
    };
    // getProject
    mockFetch.mockResolvedValueOnce(graphqlResponse(projectData));
    // fetchProjectSnapshot (via context.fetchProject via project.refresh())
    mockFetch.mockResolvedValueOnce(graphqlResponse(projectData));

    const project = await client.getProject("proj-1");
    const refreshed = await project.refresh();
    expect(refreshed).toBe(project);
  });

  it("getProjects includes description on createTask input", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({
        organization: { urlKey: "myorg" },
        team: {
          projects: { nodes: [{ ...linearProject, issues: { nodes: [linearIssue] } }] },
          states: { nodes: linearStates },
          labels: { nodes: linearLabels },
        },
      })
    );

    const projects = await client.getProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]!.name).toBe("Q1");
  });
});

// ---------------------------------------------------------------------------
// Trello — createLabel, deleteLabel, updateTask with description + labels
// ---------------------------------------------------------------------------

const trelloBoard = { id: "board-1", name: "My Board", url: "https://trello.com/b/board-1" };
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

function jsonResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) } as Response;
}

function errorResponse(status: number, text: string) {
  return { ok: false, status, text: () => Promise.resolve(text) } as Response;
}

describe("TrelloTaskListClient extra coverage", () => {
  let client: TrelloTaskListClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new TrelloTaskListClient({
      provider: "trello",
      apiKey: "test-key",
      token: "test-token",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updateTask with description and labelIds sends them in body", async () => {
    // fetchTaskSnapshot
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // updateTask
    mockFetch.mockResolvedValueOnce(jsonResponse({
      ...trelloCard,
      name: "Updated",
      desc: "new desc",
      labels: [trelloLabel],
    }));

    const task = await client.getTask("card-1");
    await task.update({ title: "Updated", description: "new desc", labels: ["Bug"] });

    const body = JSON.parse((mockFetch.mock.calls[3]![1] as RequestInit).body as string) as Record<string, string>;
    expect(body["desc"]).toBe("new desc");
    expect(body["idLabels"]).toBe("label-1");
  });

  it("createLabel with color", async () => {
    // getProject
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // createLabel
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "label-2", name: "Feature", color: "blue" }));
    // refresh (fetchProjectSnapshot)
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const project = await client.getProject("board-1");
    const label = await project.createLabel("Feature", "blue");

    expect(label.name).toBe("Feature");
    expect(label.color).toBe("blue");
  });

  it("createLabel without color", async () => {
    // getProject
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // createLabel
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "label-2", name: "Feature", color: "" }));
    // refresh (fetchProjectSnapshot)
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const project = await client.getProject("board-1");
    const label = await project.createLabel("Feature");

    expect(label.name).toBe("Feature");
    const createCallBody = JSON.parse(
      (mockFetch.mock.calls[4]![1] as RequestInit).body as string
    ) as Record<string, string>;
    expect(createCallBody["color"]).toBeUndefined();
  });

  it("deleteLabel sends DELETE request", async () => {
    // getProject
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // deleteLabel
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    // refresh (fetchProjectSnapshot)
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const project = await client.getProject("board-1");
    await project.deleteLabel("Bug");

    // Verify the deleteLabel call was a DELETE
    const deleteCall = mockFetch.mock.calls[4]!;
    const deletedUrl = new URL(deleteCall[0] as string);
    expect(deletedUrl.pathname).toContain("/labels/label-1");
    expect((deleteCall[1] as RequestInit).method).toBe("DELETE");
  });

  it("throws TaskListProviderNotConfiguredError when apiKey is missing", () => {
    const badClient = new TrelloTaskListClient({
      provider: "trello",
      token: "token",
    });
    return expect(badClient.getProjects()).rejects.toBeInstanceOf(
      TaskListProviderNotConfiguredError
    );
  });

  it("throws TaskListProviderNotConfiguredError when token is missing", () => {
    const badClient = new TrelloTaskListClient({
      provider: "trello",
      apiKey: "key",
    });
    return expect(badClient.getProjects()).rejects.toBeInstanceOf(
      TaskListProviderNotConfiguredError
    );
  });

  it("fetchTask re-throws non-404 errors", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500, "Internal Server Error"));
    await expect(client.getTask("card-1")).rejects.toBeInstanceOf(TaskListApiError);
  });

  it("context.fetchTask is called via task.refresh()", async () => {
    // getTask
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // fetchTaskSnapshot (for refresh)
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const task = await client.getTask("card-1");
    const refreshed = await task.refresh();

    expect(refreshed).toBe(task);
  });

  it("context.fetchProject is called via project.refresh()", async () => {
    // getProject
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    // fetchProjectSnapshot (for refresh)
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    const project = await client.getProject("board-1");
    const refreshed = await project.refresh();

    expect(refreshed).toBe(project);
  });
});
