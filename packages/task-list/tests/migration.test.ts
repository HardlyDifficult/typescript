import { describe, expect, it, vi } from "vitest";
import { FullState } from "../src/FullState.js";
import { findBestMatch } from "../src/migration.js";
import { Project } from "../src/Project.js";
import { Task } from "../src/Task.js";
import { TaskListClient } from "../src/TaskListClient.js";
import type {
  TaskContext,
  TaskData,
  TaskListConfig,
} from "../src/types.js";

// --- findBestMatch unit tests ---

describe("findBestMatch", () => {
  it("matches exact (case-insensitive)", () => {
    expect(findBestMatch("Done", ["To Do", "Done"])).toBe("Done");
    expect(findBestMatch("done", ["To Do", "Done"])).toBe("Done");
  });

  it("matches normalized whitespace ('To Do' ↔ 'Todo')", () => {
    expect(findBestMatch("To Do", ["Todo", "Done"])).toBe("Todo");
    expect(findBestMatch("Todo", ["To Do", "Done"])).toBe("To Do");
  });

  it("matches normalized hyphens ('In-Progress' ↔ 'In Progress')", () => {
    expect(findBestMatch("In-Progress", ["In Progress", "Done"])).toBe(
      "In Progress"
    );
  });

  it("matches when destination contains source", () => {
    expect(findBestMatch("Do", ["To Do", "Done"])).toBe("To Do");
  });

  it("matches when source contains destination", () => {
    expect(findBestMatch("To Do Now", ["Do", "Done"])).toBe("Do");
  });

  it("returns undefined when no match", () => {
    expect(findBestMatch("Archived", ["To Do", "Done"])).toBeUndefined();
  });

  it("prefers exact normalized match over partial", () => {
    expect(findBestMatch("Done", ["Done", "Almost Done"])).toBe("Done");
  });

  it("handles empty destination list", () => {
    expect(findBestMatch("Done", [])).toBeUndefined();
  });
});

// --- Mock TaskListClient for migration tests ---

function buildContext(
  statuses: { id: string; name: string }[],
  labels: { id: string; name: string }[]
): TaskContext {
  let taskCounter = 0;
  return {
    createTask: vi.fn(async (params) => {
      taskCounter++;
      return {
        id: `dest-${String(taskCounter)}`,
        name: params.name,
        description: params.description ?? "",
        statusId: params.statusId,
        projectId: params.projectId,
        labels: (params.labelIds ?? []).map((lid: string) => {
          const l = labels.find((lb) => lb.id === lid);
          return { id: lid, name: l?.name ?? "" };
        }),
        url: `https://dest.example.com/t/${String(taskCounter)}`,
      } satisfies TaskData;
    }),
    updateTask: vi.fn(async () => ({}) as TaskData),
    resolveStatusId: (name: string) => {
      const lower = name.toLowerCase();
      const s = statuses.find((st) => st.name.toLowerCase().includes(lower));
      if (!s) throw new Error(`Status "${name}" not found`);
      return s.id;
    },
    resolveStatusName: (id: string) => {
      const s = statuses.find((st) => st.id === id);
      return s?.name ?? "Unknown";
    },
    resolveLabelId: (name: string) => {
      const lower = name.toLowerCase();
      const l = labels.find((lb) => lb.name.toLowerCase().includes(lower));
      if (!l) throw new Error(`Label "${name}" not found`);
      return l.id;
    },
  };
}

function makeProject(
  info: { id: string; name: string },
  statuses: { id: string; name: string }[],
  labels: { id: string; name: string }[],
  taskDatas: TaskData[] = []
): Project {
  const ctx = buildContext(statuses, labels);
  const tasks = taskDatas.map((td) => new Task(td, ctx));
  return new Project(
    { ...info, url: `https://example.com/${info.id}` },
    statuses,
    tasks,
    labels,
    ctx
  );
}

class MockTaskListClient extends TaskListClient {
  private readonly fullState: FullState;

  constructor(fullState: FullState) {
    super({ type: "trello" } as TaskListConfig);
    this.fullState = fullState;
  }

  async getProjects(): Promise<FullState> {
    return this.fullState;
  }

  async getProject(id: string): Promise<Project> {
    const project = this.fullState.projects.find((p) => p.id === id);
    if (!project) throw new Error(`Project ${id} not found`);
    return project;
  }

  async getTask(id: string): Promise<Task> {
    return this.fullState.findTask(id);
  }
}

// --- migrateTo() integration tests ---

describe("TaskListClient.migrateTo", () => {
  const statuses = [
    { id: "s1", name: "To Do" },
    { id: "s2", name: "Done" },
  ];
  const labels = [
    { id: "l1", name: "Bug" },
    { id: "l2", name: "Feature" },
  ];

  function makeTaskData(
    overrides: Partial<TaskData> & { id: string; name: string }
  ): TaskData {
    return {
      description: "",
      statusId: "s1",
      projectId: "p1",
      labels: [],
      url: `https://src.example.com/${overrides.id}`,
      ...overrides,
    };
  }

  it("migrates tasks between matching projects", async () => {
    const sourceProject = makeProject(
      { id: "p1", name: "Alpha" },
      statuses,
      labels,
      [
        makeTaskData({
          id: "t1",
          name: "Fix bug",
          description: "Details",
          labels: [{ id: "l1", name: "Bug" }],
        }),
      ]
    );
    const source = new MockTaskListClient(new FullState([sourceProject]));

    const destStatuses = [
      { id: "ds1", name: "Todo" },
      { id: "ds2", name: "Done" },
    ];
    const destLabels = [{ id: "dl1", name: "Bug" }];
    const destProject = makeProject(
      { id: "dp1", name: "Alpha" },
      destStatuses,
      destLabels
    );
    const destination = new MockTaskListClient(new FullState([destProject]));

    const result = await source.migrateTo(destination);

    expect(result.projectsMatched).toBe(1);
    expect(result.tasksCreated).toBe(1);
    expect(result.tasksFailed).toBe(0);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.sourceTaskName).toBe("Fix bug");
    expect(result.tasks[0]!.destinationTaskId).toBeDefined();
    expect(result.tasks[0]!.error).toBeUndefined();
  });

  it("records error when destination project not found", async () => {
    const sourceProject = makeProject(
      { id: "p1", name: "Alpha" },
      statuses,
      labels,
      [makeTaskData({ id: "t1", name: "Task 1" })]
    );
    const source = new MockTaskListClient(new FullState([sourceProject]));

    const destProject = makeProject(
      { id: "dp1", name: "Beta" },
      statuses,
      labels
    );
    const destination = new MockTaskListClient(new FullState([destProject]));

    const result = await source.migrateTo(destination);

    expect(result.projectsMatched).toBe(0);
    expect(result.tasksCreated).toBe(0);
    expect(result.tasksFailed).toBe(1);
    expect(result.tasks[0]!.error).toContain("No matching destination project");
  });

  it("drops labels that do not match destination", async () => {
    const sourceProject = makeProject(
      { id: "p1", name: "Alpha" },
      statuses,
      labels,
      [
        makeTaskData({
          id: "t1",
          name: "Task 1",
          labels: [
            { id: "l1", name: "Bug" },
            { id: "l99", name: "Priority" },
          ],
        }),
      ]
    );
    const source = new MockTaskListClient(new FullState([sourceProject]));

    // Destination only has "Bug", not "Priority"
    const destLabels = [{ id: "dl1", name: "Bug" }];
    const destProject = makeProject(
      { id: "dp1", name: "Alpha" },
      statuses,
      destLabels
    );
    const destination = new MockTaskListClient(new FullState([destProject]));

    const result = await source.migrateTo(destination);

    expect(result.tasksCreated).toBe(1);
    expect(result.tasksFailed).toBe(0);
  });

  it("uses default status when no status match found", async () => {
    const srcStatuses = [
      { id: "s1", name: "Archived" },
      { id: "s2", name: "Closed" },
    ];
    const sourceProject = makeProject(
      { id: "p1", name: "Alpha" },
      srcStatuses,
      [],
      [makeTaskData({ id: "t1", name: "Old task", statusId: "s1" })]
    );
    const source = new MockTaskListClient(new FullState([sourceProject]));

    // Destination has completely different statuses
    const destStatuses = [
      { id: "ds1", name: "To Do" },
      { id: "ds2", name: "Done" },
    ];
    const destProject = makeProject(
      { id: "dp1", name: "Alpha" },
      destStatuses,
      []
    );
    const destination = new MockTaskListClient(new FullState([destProject]));

    const result = await source.migrateTo(destination);

    // Should succeed — uses default status when no match
    expect(result.tasksCreated).toBe(1);
    expect(result.tasksFailed).toBe(0);
  });

  it("continues migration when individual task creation fails", async () => {
    const sourceProject = makeProject(
      { id: "p1", name: "Alpha" },
      statuses,
      labels,
      [
        makeTaskData({ id: "t1", name: "Good task" }),
        makeTaskData({ id: "t2", name: "Bad task" }),
        makeTaskData({ id: "t3", name: "Another good task" }),
      ]
    );
    const source = new MockTaskListClient(new FullState([sourceProject]));

    // Build dest project with a context that fails on the second createTask call
    const destStatuses = [{ id: "ds1", name: "To Do" }];
    const destLabels: { id: string; name: string }[] = [];
    let callCount = 0;
    const ctx: TaskContext = {
      createTask: vi.fn(async (params) => {
        callCount++;
        if (callCount === 2) throw new Error("API failure");
        return {
          id: `dest-${String(callCount)}`,
          name: params.name,
          description: params.description ?? "",
          statusId: params.statusId,
          projectId: params.projectId,
          labels: [],
          url: `https://dest.example.com/t/${String(callCount)}`,
        };
      }),
      updateTask: vi.fn(async () => ({}) as TaskData),
      resolveStatusId: () => "ds1",
      resolveStatusName: () => "To Do",
      resolveLabelId: () => "",
    };
    const destProject = new Project(
      { id: "dp1", name: "Alpha", url: "https://dest.example.com/dp1" },
      destStatuses,
      [],
      destLabels,
      ctx
    );
    const destination = new MockTaskListClient(new FullState([destProject]));

    const result = await source.migrateTo(destination);

    expect(result.tasksCreated).toBe(2);
    expect(result.tasksFailed).toBe(1);
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[1]!.error).toBe("API failure");
    expect(result.tasks[0]!.destinationTaskId).toBeDefined();
    expect(result.tasks[2]!.destinationTaskId).toBeDefined();
  });

  it("handles empty source (no projects)", async () => {
    const source = new MockTaskListClient(new FullState([]));
    const destProject = makeProject(
      { id: "dp1", name: "Alpha" },
      statuses,
      labels
    );
    const destination = new MockTaskListClient(new FullState([destProject]));

    const result = await source.migrateTo(destination);

    expect(result.projectsMatched).toBe(0);
    expect(result.tasksCreated).toBe(0);
    expect(result.tasksFailed).toBe(0);
    expect(result.tasks).toHaveLength(0);
  });

  it("handles project with no tasks", async () => {
    const sourceProject = makeProject(
      { id: "p1", name: "Alpha" },
      statuses,
      labels
    );
    const source = new MockTaskListClient(new FullState([sourceProject]));

    const destProject = makeProject(
      { id: "dp1", name: "Alpha" },
      statuses,
      labels
    );
    const destination = new MockTaskListClient(new FullState([destProject]));

    const result = await source.migrateTo(destination);

    expect(result.projectsMatched).toBe(1);
    expect(result.tasksCreated).toBe(0);
    expect(result.tasksFailed).toBe(0);
  });

  it("matches projects with normalized names", async () => {
    const sourceProject = makeProject(
      { id: "p1", name: "Q1 Road-Map" },
      statuses,
      labels,
      [makeTaskData({ id: "t1", name: "Task 1" })]
    );
    const source = new MockTaskListClient(new FullState([sourceProject]));

    const destProject = makeProject(
      { id: "dp1", name: "Q1 Roadmap" },
      statuses,
      labels
    );
    const destination = new MockTaskListClient(new FullState([destProject]));

    const result = await source.migrateTo(destination);

    expect(result.projectsMatched).toBe(1);
    expect(result.tasksCreated).toBe(1);
  });
});
