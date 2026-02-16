import { describe, expect, it, vi } from "vitest";
import { Task } from "../src/Task.js";
import { Project } from "../src/Project.js";
import type { TaskContext, TaskData } from "../src/types.js";

function createMockContext(
  overrides: Partial<TaskContext> = {}
): TaskContext {
  return {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    resolveStatusId: vi.fn((name: string) => `status-id-for-${name}`),
    resolveStatusName: vi.fn((id: string) =>
      id === "status-1" ? "To Do" : "Unknown"
    ),
    resolveLabelId: vi.fn((name: string) => `label-id-for-${name}`),
    ...overrides,
  };
}

const baseTaskData: TaskData = {
  id: "task-1",
  name: "Original name",
  description: "Original desc",
  statusId: "status-1",
  projectId: "project-1",
  labels: [{ id: "l1", name: "Bug" }],
  url: "https://example.com/t/1",
};

describe("Task", () => {
  it("exposes all fields with resolved names", () => {
    const ctx = createMockContext();
    const task = new Task(baseTaskData, ctx);

    expect(task.id).toBe("task-1");
    expect(task.name).toBe("Original name");
    expect(task.description).toBe("Original desc");
    expect(task.status).toBe("To Do");
    expect(task.projectId).toBe("project-1");
    expect(task.labels).toEqual(["Bug"]);
    expect(task.url).toBe("https://example.com/t/1");
  });

  it("resolves status name from ID via context", () => {
    const ctx = createMockContext();
    new Task(baseTaskData, ctx);
    expect(ctx.resolveStatusName).toHaveBeenCalledWith("status-1");
  });

  it("update() resolves status and label names to IDs", async () => {
    const updatedData: TaskData = {
      ...baseTaskData,
      name: "Updated name",
      statusId: "status-2",
      labels: [{ id: "l2", name: "Feature" }],
    };
    const ctx = createMockContext({
      updateTask: vi.fn().mockResolvedValue(updatedData),
      resolveStatusId: vi.fn().mockReturnValue("status-2"),
      resolveStatusName: vi.fn((id: string) =>
        id === "status-2" ? "Done" : "To Do"
      ),
      resolveLabelId: vi.fn().mockReturnValue("l2"),
    });
    const task = new Task(baseTaskData, ctx);

    const updated = await task.update({
      name: "Updated name",
      status: "Done",
      labels: ["Feature"],
    });

    expect(ctx.resolveStatusId).toHaveBeenCalledWith("Done");
    expect(ctx.resolveLabelId).toHaveBeenCalledWith("Feature");
    expect(ctx.updateTask).toHaveBeenCalledWith({
      taskId: "task-1",
      name: "Updated name",
      description: undefined,
      statusId: "status-2",
      labelIds: ["l2"],
    });
    expect(updated).toBeInstanceOf(Task);
    expect(updated.name).toBe("Updated name");
    expect(updated.status).toBe("Done");
  });

  it("update() passes undefined for omitted fields", async () => {
    const ctx = createMockContext({
      updateTask: vi.fn().mockResolvedValue(baseTaskData),
    });
    const task = new Task(baseTaskData, ctx);

    await task.update({ name: "New name" });

    expect(ctx.updateTask).toHaveBeenCalledWith({
      taskId: "task-1",
      name: "New name",
      description: undefined,
      statusId: undefined,
      labelIds: undefined,
    });
  });

  it("original task is unchanged after update", async () => {
    const updatedData: TaskData = {
      ...baseTaskData,
      name: "Updated",
    };
    const ctx = createMockContext({
      updateTask: vi.fn().mockResolvedValue(updatedData),
    });
    const task = new Task(baseTaskData, ctx);

    await task.update({ name: "Updated" });

    expect(task.name).toBe("Original name");
  });
});

describe("Project", () => {
  it("exposes all fields with string statuses and labels", () => {
    const ctx = createMockContext();
    const project = new Project(
      { id: "p1", name: "Alpha", url: "https://example.com/p/1" },
      [
        { id: "s1", name: "To Do" },
        { id: "s2", name: "Done" },
      ],
      [],
      [{ id: "l1", name: "Bug" }],
      ctx
    );

    expect(project.id).toBe("p1");
    expect(project.name).toBe("Alpha");
    expect(project.url).toBe("https://example.com/p/1");
    expect(project.statuses).toEqual(["To Do", "Done"]);
    expect(project.labels).toEqual(["Bug"]);
    expect(project.tasks).toEqual([]);
  });

  it("createTask() with name only uses default status", async () => {
    const ctx = createMockContext({
      createTask: vi.fn().mockResolvedValue(baseTaskData),
    });
    const project = new Project(
      { id: "p1", name: "Alpha", url: "" },
      [{ id: "s1", name: "To Do" }],
      [],
      [],
      ctx
    );

    const task = await project.createTask("Fix bug");

    expect(ctx.createTask).toHaveBeenCalledWith({
      statusId: "s1",
      projectId: "p1",
      name: "Fix bug",
      description: undefined,
      labelIds: undefined,
    });
    expect(task).toBeInstanceOf(Task);
  });

  it("createTask() with status and labels resolves names", async () => {
    const ctx = createMockContext({
      createTask: vi.fn().mockResolvedValue(baseTaskData),
      resolveStatusId: vi.fn().mockReturnValue("s2"),
      resolveLabelId: vi.fn().mockReturnValue("l1"),
    });
    const project = new Project(
      { id: "p1", name: "Alpha", url: "" },
      [
        { id: "s1", name: "To Do" },
        { id: "s2", name: "In Progress" },
      ],
      [],
      [{ id: "l1", name: "Bug" }],
      ctx
    );

    await project.createTask("Fix bug", {
      description: "Details",
      status: "In Progress",
      labels: ["Bug"],
    });

    expect(ctx.resolveStatusId).toHaveBeenCalledWith("In Progress");
    expect(ctx.resolveLabelId).toHaveBeenCalledWith("Bug");
    expect(ctx.createTask).toHaveBeenCalledWith({
      statusId: "s2",
      projectId: "p1",
      name: "Fix bug",
      description: "Details",
      labelIds: ["l1"],
    });
  });

  it("findTask() finds a task by ID", () => {
    const ctx = createMockContext();
    const task = new Task(baseTaskData, ctx);
    const project = new Project(
      { id: "p1", name: "Alpha", url: "" },
      [{ id: "s1", name: "To Do" }],
      [task],
      [],
      ctx
    );

    expect(project.findTask("task-1").name).toBe("Original name");
  });

  it("findTask() throws when not found", () => {
    const ctx = createMockContext();
    const project = new Project(
      { id: "p1", name: "Alpha", url: "" },
      [],
      [],
      [],
      ctx
    );

    expect(() => project.findTask("nonexistent")).toThrow(
      'Task "nonexistent" not found in project "Alpha"'
    );
  });
});
