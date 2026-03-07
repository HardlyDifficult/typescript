import { describe, expect, it, vi } from "vitest";

import { Project } from "../src/Project.js";
import { Task } from "../src/Task.js";
import {
  LabelNotFoundError,
  StatusNotFoundError,
  TaskNotFoundError,
} from "../src/errors.js";
import type {
  Label,
  ProjectSnapshot,
  Status,
  TaskContext,
  TaskData,
  TaskSnapshot,
} from "../src/types.js";

const statuses: readonly Status[] = [
  { id: "status-1", name: "To Do" },
  { id: "status-2", name: "Done" },
];

const labels: readonly Label[] = [
  { id: "label-1", name: "Bug", color: "#ff0000" },
  { id: "label-2", name: "Feature", color: "#00ff00" },
];

function createMockContext(overrides: Partial<TaskContext> = {}): TaskContext {
  const context: TaskContext = {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    fetchTask: vi.fn(),
    fetchProject: vi.fn(),
    createLabel: vi.fn(),
    deleteLabel: vi.fn(),
    resolveStatusId: vi.fn((name: string) => {
      if (name.toLowerCase() === "to do") return "status-1";
      if (name.toLowerCase() === "done") return "status-2";
      return `status-${name}`;
    }),
    resolveStatusName: vi.fn((id: string) => {
      return id === "status-2" ? "Done" : "To Do";
    }),
    resolveLabelId: vi.fn((name: string) => {
      if (name.toLowerCase() === "bug") return "label-1";
      if (name.toLowerCase() === "feature") return "label-2";
      return `label-${name}`;
    }),
    resolvePriority: vi.fn((name: string) => {
      const map: Record<string, number> = {
        none: 0,
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };
      return map[name.toLowerCase()] ?? 0;
    }),
    labels,
    statuses,
    ...overrides,
  };

  return context;
}

const baseTaskData: TaskData = {
  id: "task-1",
  title: "Original title",
  description: "Original description",
  statusId: "status-1",
  projectId: "project-1",
  labels: [labels[0]!],
  url: "https://example.com/tasks/1",
  priority: 2,
};

function createTaskSnapshot(
  data: TaskData = baseTaskData,
  context: TaskContext = createMockContext()
): TaskSnapshot {
  return {
    task: data,
    context,
  };
}

function createProjectSnapshot(
  taskData: readonly TaskData[] = [],
  context: TaskContext = createMockContext()
): ProjectSnapshot {
  return {
    info: {
      id: "project-1",
      name: "Alpha",
      url: "https://example.com/projects/1",
    },
    statuses,
    labels,
    tasks: taskData,
    context,
  };
}

describe("Task", () => {
  it("exposes resolved, user-facing fields", () => {
    const context = createMockContext();
    const task = new Task(createTaskSnapshot(baseTaskData, context));

    expect(task.id).toBe("task-1");
    expect(task.title).toBe("Original title");
    expect(task.description).toBe("Original description");
    expect(task.status).toBe("To Do");
    expect(task.projectId).toBe("project-1");
    expect(task.labels).toEqual(["Bug"]);
    expect(task.url).toBe("https://example.com/tasks/1");
    expect(task.priority).toBe("High");
  });

  it("update() mutates the current task and returns the same instance", async () => {
    const updatedData: TaskData = {
      ...baseTaskData,
      title: "Updated title",
      statusId: "status-2",
      labels: [labels[1]!],
    };
    const context = createMockContext({
      updateTask: vi
        .fn()
        .mockResolvedValue(createTaskSnapshot(updatedData, createMockContext())),
    });
    const task = new Task(createTaskSnapshot(baseTaskData, context));

    const updated = await task.update({
      title: "Updated title",
      status: "Done",
      labels: ["Feature"],
    });

    expect(updated).toBe(task);
    expect(context.resolveStatusId).toHaveBeenCalledWith("Done");
    expect(context.resolveLabelId).toHaveBeenCalledWith("Feature");
    expect(context.updateTask).toHaveBeenCalledWith({
      taskId: "task-1",
      title: "Updated title",
      description: undefined,
      statusId: "status-2",
      labelIds: ["label-2"],
      priority: undefined,
    });
    expect(task.title).toBe("Updated title");
    expect(task.status).toBe("Done");
    expect(task.labels).toEqual(["Feature"]);
  });

  it("update() resolves priority names", async () => {
    const context = createMockContext({
      updateTask: vi
        .fn()
        .mockResolvedValue(createTaskSnapshot({ ...baseTaskData, priority: 1 })),
    });
    const task = new Task(createTaskSnapshot(baseTaskData, context));

    await task.update({ priority: "Urgent" });

    expect(context.resolvePriority).toHaveBeenCalledWith("Urgent");
    expect(context.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 1 })
    );
    expect(task.priority).toBe("Urgent");
  });

  it("tag() appends labels without duplicating existing entries", async () => {
    const updatedData: TaskData = {
      ...baseTaskData,
      labels,
    };
    const context = createMockContext({
      updateTask: vi
        .fn()
        .mockResolvedValue(createTaskSnapshot(updatedData, createMockContext())),
    });
    const task = new Task(createTaskSnapshot(baseTaskData, context));

    const updated = await task.tag("Feature", "Bug");

    expect(updated).toBe(task);
    expect(task.labels).toEqual(["Bug", "Feature"]);
    expect(context.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ labelIds: ["label-1", "label-2"] })
    );
  });

  it("untag() removes labels by exact case-insensitive name", async () => {
    const context = createMockContext({
      updateTask: vi.fn().mockResolvedValue(
        createTaskSnapshot({
          ...baseTaskData,
          labels: [],
        })
      ),
    });
    const task = new Task(
      createTaskSnapshot(
        {
          ...baseTaskData,
          labels,
        },
        context
      )
    );

    await task.untag("feature", "bug");

    expect(task.labels).toEqual([]);
    expect(context.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ labelIds: [] })
    );
  });

  it("moveTo() delegates through update()", async () => {
    const context = createMockContext({
      updateTask: vi.fn().mockResolvedValue(
        createTaskSnapshot({
          ...baseTaskData,
          statusId: "status-2",
        })
      ),
    });
    const task = new Task(createTaskSnapshot(baseTaskData, context));

    await task.moveTo("Done");

    expect(task.status).toBe("Done");
    expect(context.resolveStatusId).toHaveBeenCalledWith("Done");
  });

  it("refresh() reloads the current task in place", async () => {
    const refreshedData: TaskData = {
      ...baseTaskData,
      title: "Fresh title",
    };
    const context = createMockContext({
      fetchTask: vi
        .fn()
        .mockResolvedValue(createTaskSnapshot(refreshedData, createMockContext())),
    });
    const task = new Task(createTaskSnapshot(baseTaskData, context));

    const refreshed = await task.refresh();

    expect(refreshed).toBe(task);
    expect(context.fetchTask).toHaveBeenCalledWith("task-1");
    expect(task.title).toBe("Fresh title");
  });
});

describe("Project", () => {
  it("createTask() uses the default status when none is provided", async () => {
    const context = createMockContext({
      createTask: vi.fn().mockResolvedValue(createTaskSnapshot(baseTaskData)),
    });
    const project = new Project(createProjectSnapshot([], context));

    const task = await project.createTask({ title: "Fix login" });

    expect(task).toBeInstanceOf(Task);
    expect(context.createTask).toHaveBeenCalledWith({
      projectId: "project-1",
      title: "Fix login",
      statusId: "status-1",
      description: undefined,
      labelIds: undefined,
      priority: undefined,
    });
  });

  it("createTask() resolves labels, statuses, and priority", async () => {
    const context = createMockContext({
      createTask: vi.fn().mockResolvedValue(createTaskSnapshot(baseTaskData)),
    });
    const project = new Project(createProjectSnapshot([], context));

    await project.createTask({
      title: "Fix login",
      description: "Users are blocked",
      status: "Done",
      labels: ["Bug"],
      priority: "High",
    });

    expect(context.resolveStatusId).toHaveBeenCalledWith("Done");
    expect(context.resolveLabelId).toHaveBeenCalledWith("Bug");
    expect(context.resolvePriority).toHaveBeenCalledWith("High");
    expect(context.createTask).toHaveBeenCalledWith({
      projectId: "project-1",
      title: "Fix login",
      statusId: "status-2",
      description: "Users are blocked",
      labelIds: ["label-1"],
      priority: 2,
    });
  });

  it("tasks() filters by exact, case-insensitive status, label, and priority", () => {
    const context = createMockContext();
    const project = new Project(
      createProjectSnapshot(
        [
          baseTaskData,
          {
            ...baseTaskData,
            id: "task-2",
            title: "Ship feature",
            statusId: "status-2",
            labels: [labels[1]!],
            priority: 4,
          },
        ],
        context
      )
    );

    expect(project.tasks({ status: "to do" })).toHaveLength(1);
    expect(project.tasks({ label: "feature" })).toHaveLength(1);
    expect(project.tasks({ labels: ["Bug"] })).toHaveLength(1);
    expect(project.tasks({ priority: "Low" })).toHaveLength(1);
    expect(project.tasks({ status: "to", label: "Bug" })).toHaveLength(0);
  });

  it("findTask() throws with available task ids when missing", () => {
    const project = new Project(createProjectSnapshot([baseTaskData]));

    expect(() => project.findTask("missing")).toThrow(TaskNotFoundError);
    expect(() => project.findTask("missing")).toThrow(/task-1/);
  });

  it("findStatus() and findLabel() use exact case-insensitive matching", () => {
    const project = new Project(createProjectSnapshot());

    expect(project.findStatus("to do")).toEqual(statuses[0]);
    expect(project.findLabel("bug")).toEqual(labels[0]);
    expect(() => project.findStatus("do")).toThrow(StatusNotFoundError);
    expect(() => project.findLabel("bu")).toThrow(LabelNotFoundError);
  });

  it("refresh() replaces the loaded project snapshot in place", async () => {
    const refreshedSnapshot = createProjectSnapshot([
      {
        ...baseTaskData,
        id: "task-2",
        title: "Fresh task",
      },
    ]);
    const context = createMockContext({
      fetchProject: vi.fn().mockResolvedValue(refreshedSnapshot),
    });
    const project = new Project(createProjectSnapshot([baseTaskData], context));

    const refreshed = await project.refresh();

    expect(refreshed).toBe(project);
    expect(context.fetchProject).toHaveBeenCalledWith("project-1");
    expect(project.tasks()).toHaveLength(1);
    expect(project.tasks()[0]!.title).toBe("Fresh task");
  });

  it("createLabel() and deleteLabel() refresh project state", async () => {
    const refreshedContext = createMockContext();
    const refreshedSnapshot = createProjectSnapshot([], refreshedContext);
    refreshedContext.deleteLabel = vi.fn().mockResolvedValue(undefined);
    refreshedContext.fetchProject = vi.fn().mockResolvedValue(refreshedSnapshot);
    const context = createMockContext({
      createLabel: vi.fn().mockResolvedValue({
        id: "label-3",
        name: "Chore",
        color: "#0000ff",
      }),
      deleteLabel: vi.fn().mockResolvedValue(undefined),
      fetchProject: vi.fn().mockResolvedValue(refreshedSnapshot),
    });
    const project = new Project(createProjectSnapshot([], context));

    await project.createLabel("Chore");
    await project.deleteLabel("Bug");

    expect(context.createLabel).toHaveBeenCalledWith("Chore", undefined);
    expect(refreshedContext.deleteLabel).toHaveBeenCalledWith("label-1");
    expect(context.fetchProject).toHaveBeenCalledTimes(1);
    expect(refreshedContext.fetchProject).toHaveBeenCalledTimes(1);
  });
});
