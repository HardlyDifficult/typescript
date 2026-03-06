import { describe, expect, it, vi } from "vitest";
import { Task } from "../src/Task.js";
import { Project } from "../src/Project.js";
import {
  LabelNotFoundError,
  StatusNotFoundError,
  TaskNotFoundError,
} from "../src/errors.js";
import type { TaskContext, TaskData } from "../src/types.js";

function createMockContext(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    addTaskLabel: vi.fn(),
    removeTaskLabel: vi.fn(),
    createLabel: vi.fn(),
    deleteLabel: vi.fn(),
    resolveStatusId: vi.fn((name: string) => `status-id-for-${name}`),
    resolveStatusName: vi.fn((id: string) =>
      id === "status-1" ? "To Do" : "Unknown"
    ),
    resolveLabelId: vi.fn((name: string) => `label-id-for-${name}`),
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
    labels: [
      { id: "l1", name: "Bug", color: "#ff0000" },
      { id: "l2", name: "Feature", color: "#00ff00" },
    ],
    statuses: [
      { id: "status-1", name: "To Do" },
      { id: "status-2", name: "Done" },
    ],
    ...overrides,
  };
}

const baseTaskData: TaskData = {
  id: "task-1",
  name: "Original name",
  description: "Original desc",
  statusId: "status-1",
  projectId: "project-1",
  labels: [{ id: "l1", name: "Bug", color: "#ff0000" }],
  url: "https://example.com/t/1",
  priority: 2,
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
    expect(task.priority).toBe("High");
  });

  it("resolves status name from ID via context", () => {
    const ctx = createMockContext();
    new Task(baseTaskData, ctx);
    expect(ctx.resolveStatusName).toHaveBeenCalledWith("status-1");
  });

  it("maps priority undefined when not in TaskData", () => {
    const ctx = createMockContext();
    const dataWithoutPriority: TaskData = {
      ...baseTaskData,
      priority: undefined,
    };
    const task = new Task(dataWithoutPriority, ctx);
    expect(task.priority).toBeUndefined();
  });

  it("update() resolves status and label names to IDs", async () => {
    const updatedData: TaskData = {
      ...baseTaskData,
      name: "Updated name",
      statusId: "status-2",
      labels: [{ id: "l2", name: "Feature", color: "#00ff00" }],
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
      priority: undefined,
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
      priority: undefined,
    });
  });

  it("update() resolves priority", async () => {
    const ctx = createMockContext({
      updateTask: vi.fn().mockResolvedValue({ ...baseTaskData, priority: 1 }),
    });
    const task = new Task(baseTaskData, ctx);

    await task.update({ priority: "Urgent" });

    expect(ctx.resolvePriority).toHaveBeenCalledWith("Urgent");
    expect(ctx.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 1 })
    );
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

  it("addLabel() resolves name and calls addTaskLabel", async () => {
    const updatedData: TaskData = {
      ...baseTaskData,
      labels: [
        { id: "l1", name: "Bug", color: "#ff0000" },
        { id: "l2", name: "Feature", color: "#00ff00" },
      ],
    };
    const ctx = createMockContext({
      addTaskLabel: vi.fn().mockResolvedValue(updatedData),
      resolveLabelId: vi.fn().mockReturnValue("l2"),
    });
    const task = new Task(baseTaskData, ctx);

    const updated = await task.addLabel("Feature");

    expect(ctx.resolveLabelId).toHaveBeenCalledWith("Feature");
    expect(ctx.addTaskLabel).toHaveBeenCalledWith("task-1", "l2");
    expect(updated.labels).toEqual(["Bug", "Feature"]);
  });

  it("removeLabel() resolves name and calls removeTaskLabel", async () => {
    const updatedData: TaskData = {
      ...baseTaskData,
      labels: [],
    };
    const ctx = createMockContext({
      removeTaskLabel: vi.fn().mockResolvedValue(updatedData),
      resolveLabelId: vi.fn().mockReturnValue("l1"),
    });
    const task = new Task(baseTaskData, ctx);

    const updated = await task.removeLabel("Bug");

    expect(ctx.resolveLabelId).toHaveBeenCalledWith("Bug");
    expect(ctx.removeTaskLabel).toHaveBeenCalledWith("task-1", "l1");
    expect(updated.labels).toEqual([]);
  });

  it("setStatus() delegates to update()", async () => {
    const updatedData: TaskData = {
      ...baseTaskData,
      statusId: "status-2",
    };
    const ctx = createMockContext({
      updateTask: vi.fn().mockResolvedValue(updatedData),
      resolveStatusId: vi.fn().mockReturnValue("status-2"),
      resolveStatusName: vi.fn((id: string) =>
        id === "status-2" ? "Done" : "To Do"
      ),
    });
    const task = new Task(baseTaskData, ctx);

    const updated = await task.setStatus("Done");

    expect(ctx.resolveStatusId).toHaveBeenCalledWith("Done");
    expect(updated.status).toBe("Done");
  });
});

describe("Project", () => {
  it("exposes statuses and labels as objects", () => {
    const ctx = createMockContext();
    const project = new Project(
      { id: "p1", name: "Alpha", url: "https://example.com/p/1" },
      [
        { id: "s1", name: "To Do" },
        { id: "s2", name: "Done" },
      ],
      [],
      [{ id: "l1", name: "Bug", color: "#ff0000" }],
      ctx
    );

    expect(project.id).toBe("p1");
    expect(project.name).toBe("Alpha");
    expect(project.url).toBe("https://example.com/p/1");
    expect(project.statuses).toEqual([
      { id: "s1", name: "To Do" },
      { id: "s2", name: "Done" },
    ]);
    expect(project.labels).toEqual([
      { id: "l1", name: "Bug", color: "#ff0000" },
    ]);
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
      priority: undefined,
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
      [{ id: "l1", name: "Bug", color: "#ff0000" }],
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
      priority: undefined,
    });
  });

  it("createTask() with priority", async () => {
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

    await project.createTask("Fix bug", { priority: "High" });

    expect(ctx.resolvePriority).toHaveBeenCalledWith("High");
    expect(ctx.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 2 })
    );
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

    expect(() => project.findTask("nonexistent")).toThrow(TaskNotFoundError);
    try {
      project.findTask("nonexistent");
    } catch (error) {
      expect(error).toBeInstanceOf(TaskNotFoundError);
      expect((error as TaskNotFoundError).code).toBe("TASK_NOT_FOUND");
    }
  });

  describe("getTasks", () => {
    function buildProjectWithTasks() {
      const ctx = createMockContext();
      const task1 = new Task(baseTaskData, ctx);
      const task2 = new Task(
        {
          ...baseTaskData,
          id: "task-2",
          name: "Add feature",
          statusId: "status-2",
          labels: [{ id: "l2", name: "Feature", color: "#00ff00" }],
          priority: 4,
        },
        {
          ...ctx,
          resolveStatusName: (id: string) =>
            id === "status-1" ? "To Do" : "Done",
        }
      );
      return new Project(
        { id: "p1", name: "Alpha", url: "" },
        [
          { id: "status-1", name: "To Do" },
          { id: "status-2", name: "Done" },
        ],
        [task1, task2],
        [
          { id: "l1", name: "Bug", color: "#ff0000" },
          { id: "l2", name: "Feature", color: "#00ff00" },
        ],
        ctx
      );
    }

    it("returns all tasks when no filter", () => {
      const project = buildProjectWithTasks();
      expect(project.getTasks()).toHaveLength(2);
    });

    it("filters by status", () => {
      const project = buildProjectWithTasks();
      const tasks = project.getTasks({ status: "To Do" });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.name).toBe("Original name");
    });

    it("filters by label", () => {
      const project = buildProjectWithTasks();
      const tasks = project.getTasks({ label: "Feature" });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.name).toBe("Add feature");
    });

    it("filters by labels (AND)", () => {
      const project = buildProjectWithTasks();
      const tasks = project.getTasks({ labels: ["Bug"] });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.name).toBe("Original name");
    });

    it("filters by priority", () => {
      const project = buildProjectWithTasks();
      const tasks = project.getTasks({ priority: "High" });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.name).toBe("Original name");
    });

    it("combines filters with AND logic", () => {
      const project = buildProjectWithTasks();
      const tasks = project.getTasks({ status: "To Do", label: "Feature" });
      expect(tasks).toHaveLength(0);
    });
  });

  describe("findStatus / findLabel", () => {
    it("findStatus finds by partial name", () => {
      const ctx = createMockContext();
      const project = new Project(
        { id: "p1", name: "Alpha", url: "" },
        [
          { id: "s1", name: "To Do" },
          { id: "s2", name: "Done" },
        ],
        [],
        [],
        ctx
      );

      expect(project.findStatus("do")).toEqual({ id: "s1", name: "To Do" });
    });

    it("findStatus throws when not found", () => {
      const ctx = createMockContext();
      const project = new Project(
        { id: "p1", name: "Alpha", url: "" },
        [],
        [],
        [],
        ctx
      );

      expect(() => project.findStatus("Missing")).toThrow(StatusNotFoundError);
      try {
        project.findStatus("Missing");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusNotFoundError);
        expect((error as StatusNotFoundError).code).toBe("STATUS_NOT_FOUND");
      }
    });

    it("findLabel finds by partial name", () => {
      const ctx = createMockContext();
      const project = new Project(
        { id: "p1", name: "Alpha", url: "" },
        [],
        [],
        [{ id: "l1", name: "Bug", color: "#ff0000" }],
        ctx
      );

      expect(project.findLabel("bug")).toEqual({
        id: "l1",
        name: "Bug",
        color: "#ff0000",
      });
    });

    it("findLabel throws when not found", () => {
      const ctx = createMockContext();
      const project = new Project(
        { id: "p1", name: "Alpha", url: "" },
        [],
        [],
        [],
        ctx
      );

      expect(() => project.findLabel("Missing")).toThrow(LabelNotFoundError);
      try {
        project.findLabel("Missing");
      } catch (error) {
        expect(error).toBeInstanceOf(LabelNotFoundError);
        expect((error as LabelNotFoundError).code).toBe("LABEL_NOT_FOUND");
      }
    });
  });

  describe("label CRUD", () => {
    it("createLabel delegates to context", async () => {
      const ctx = createMockContext({
        createLabel: vi
          .fn()
          .mockResolvedValue({ id: "l3", name: "New", color: "#0000ff" }),
      });
      const project = new Project(
        { id: "p1", name: "Alpha", url: "" },
        [],
        [],
        [],
        ctx
      );

      const label = await project.createLabel("New", { color: "#0000ff" });
      expect(ctx.createLabel).toHaveBeenCalledWith("New", "#0000ff");
      expect(label).toEqual({ id: "l3", name: "New", color: "#0000ff" });
    });

    it("deleteLabel resolves name and delegates", async () => {
      const ctx = createMockContext({
        deleteLabel: vi.fn().mockResolvedValue(undefined),
      });
      const project = new Project(
        { id: "p1", name: "Alpha", url: "" },
        [],
        [],
        [{ id: "l1", name: "Bug", color: "#ff0000" }],
        ctx
      );

      await project.deleteLabel("Bug");
      expect(ctx.deleteLabel).toHaveBeenCalledWith("l1");
    });
  });

  describe("updateTasks", () => {
    it("updates matching tasks and returns result", async () => {
      const ctx = createMockContext({
        updateTask: vi.fn().mockResolvedValue({
          ...baseTaskData,
          statusId: "status-2",
        }),
        resolveStatusId: vi.fn().mockReturnValue("status-2"),
        resolveStatusName: vi.fn((id: string) =>
          id === "status-2" ? "Done" : "To Do"
        ),
      });
      const task = new Task(baseTaskData, ctx);
      const project = new Project(
        { id: "p1", name: "Alpha", url: "" },
        [
          { id: "status-1", name: "To Do" },
          { id: "status-2", name: "Done" },
        ],
        [task],
        [{ id: "l1", name: "Bug", color: "#ff0000" }],
        ctx
      );

      const result = await project.updateTasks(
        { label: "Bug" },
        { status: "Done" }
      );

      expect(result.count).toBe(1);
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0]!.status).toBe("Done");
    });
  });
});
