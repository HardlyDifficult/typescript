import { describe, expect, it, vi } from "vitest";
import { Task } from "../src/Task.js";
import { TaskList } from "../src/TaskList.js";
import type { TaskData, TaskOperations } from "../src/types.js";

const baseTaskData: TaskData = {
  id: "task-1",
  name: "Original name",
  description: "Original desc",
  listId: "list-1",
  boardId: "board-1",
  labels: [{ id: "l1", name: "Bug", color: "red" }],
  url: "https://example.com/t/1",
};

describe("Task", () => {
  it("exposes all fields from TaskData", () => {
    const ops: TaskOperations = { createTask: vi.fn(), updateTask: vi.fn() };
    const task = new Task(baseTaskData, ops);

    expect(task.id).toBe("task-1");
    expect(task.name).toBe("Original name");
    expect(task.description).toBe("Original desc");
    expect(task.listId).toBe("list-1");
    expect(task.boardId).toBe("board-1");
    expect(task.labels).toEqual([{ id: "l1", name: "Bug", color: "red" }]);
    expect(task.url).toBe("https://example.com/t/1");
  });

  it("update() calls operations with correct args and returns new Task", async () => {
    const updatedData: TaskData = {
      ...baseTaskData,
      name: "Updated name",
      description: "Updated desc",
      listId: "list-2",
      labels: [{ id: "l2", name: "Feature", color: "blue" }],
    };
    const updateTask = vi.fn().mockResolvedValue(updatedData);
    const ops: TaskOperations = { createTask: vi.fn(), updateTask };
    const task = new Task(baseTaskData, ops);

    const bugLabel = { id: "l2", name: "Feature", color: "blue" };
    const targetList = new TaskList(
      { id: "list-2", name: "Done", boardId: "board-1" },
      ops
    );
    const updated = await task.update({
      name: "Updated name",
      description: "Updated desc",
      list: targetList,
      labels: [bugLabel],
    });

    expect(updateTask).toHaveBeenCalledWith(
      "task-1",
      "Updated name",
      "Updated desc",
      "list-2",
      ["l2"]
    );
    expect(updated).toBeInstanceOf(Task);
    expect(updated.name).toBe("Updated name");
    expect(updated.listId).toBe("list-2");
    // Original task is unchanged
    expect(task.name).toBe("Original name");
  });

  it("update() passes undefined for omitted fields", async () => {
    const updateTask = vi.fn().mockResolvedValue(baseTaskData);
    const ops: TaskOperations = { createTask: vi.fn(), updateTask };
    const task = new Task(baseTaskData, ops);

    await task.update({ name: "New name" });

    expect(updateTask).toHaveBeenCalledWith(
      "task-1",
      "New name",
      undefined,
      undefined,
      undefined
    );
  });
});

describe("TaskList", () => {
  it("exposes all fields from TaskListData", () => {
    const ops: TaskOperations = { createTask: vi.fn(), updateTask: vi.fn() };
    const list = new TaskList(
      { id: "list-1", name: "To Do", boardId: "board-1" },
      ops
    );
    expect(list.id).toBe("list-1");
    expect(list.name).toBe("To Do");
    expect(list.boardId).toBe("board-1");
  });

  it("createTask() with name only", async () => {
    const createTask = vi.fn().mockResolvedValue(baseTaskData);
    const ops: TaskOperations = { createTask, updateTask: vi.fn() };
    const list = new TaskList(
      { id: "list-1", name: "To Do", boardId: "board-1" },
      ops
    );

    const task = await list.createTask("Fix bug");

    expect(createTask).toHaveBeenCalledWith(
      "list-1",
      "Fix bug",
      undefined,
      undefined
    );
    expect(task).toBeInstanceOf(Task);
    expect(task.id).toBe("task-1");
  });

  it("createTask() with description and labels", async () => {
    const createTask = vi.fn().mockResolvedValue(baseTaskData);
    const ops: TaskOperations = { createTask, updateTask: vi.fn() };
    const list = new TaskList(
      { id: "list-1", name: "To Do", boardId: "board-1" },
      ops
    );

    const label = { id: "l1", name: "Bug", color: "red" };
    await list.createTask("Fix bug", {
      description: "Details here",
      labels: [label],
    });

    expect(createTask).toHaveBeenCalledWith(
      "list-1",
      "Fix bug",
      "Details here",
      ["l1"]
    );
  });
});
