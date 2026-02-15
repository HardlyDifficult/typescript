import { describe, expect, it, vi } from "vitest";
import { BoardState } from "../src/BoardState.js";
import { Task } from "../src/Task.js";
import { TaskList } from "../src/TaskList.js";
import type { TaskOperations } from "../src/types.js";

const mockOps: TaskOperations = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
};

function buildBoardState() {
  return new BoardState(
    { id: "board-1", name: "Project Alpha", url: "https://example.com/b/1" },
    [
      new TaskList(
        { id: "list-1", name: "To Do", boardId: "board-1" },
        mockOps
      ),
      new TaskList(
        { id: "list-2", name: "In Progress", boardId: "board-1" },
        mockOps
      ),
      new TaskList({ id: "list-3", name: "Done", boardId: "board-1" }, mockOps),
    ],
    [
      new Task(
        {
          id: "task-1",
          name: "Fix bug",
          description: "A bug fix",
          listId: "list-1",
          boardId: "board-1",
          labels: [{ id: "l1", name: "Bug", color: "red" }],
          url: "https://example.com/t/1",
        },
        mockOps
      ),
      new Task(
        {
          id: "task-2",
          name: "Add feature",
          description: "New feature",
          listId: "list-2",
          boardId: "board-1",
          labels: [],
          url: "https://example.com/t/2",
        },
        mockOps
      ),
    ],
    [
      { id: "l1", name: "Bug", color: "red" },
      { id: "l2", name: "Enhancement", color: "green" },
    ]
  );
}

describe("BoardState.findList", () => {
  it("finds a list by exact name", () => {
    const board = buildBoardState();
    const list = board.findList("To Do");
    expect(list.id).toBe("list-1");
    expect(list.name).toBe("To Do");
  });

  it("finds a list by partial name (case-insensitive)", () => {
    const board = buildBoardState();
    const list = board.findList("progress");
    expect(list.id).toBe("list-2");
  });

  it("throws when list not found", () => {
    const board = buildBoardState();
    expect(() => board.findList("Nonexistent")).toThrow(
      'List "Nonexistent" not found on board "Project Alpha"'
    );
  });

  it("returns a TaskList with createTask capability", () => {
    const board = buildBoardState();
    const list = board.findList("To Do");
    expect(list).toBeInstanceOf(TaskList);
    expect(typeof list.createTask).toBe("function");
  });
});

describe("BoardState.findTask", () => {
  it("finds a task by ID", () => {
    const board = buildBoardState();
    const task = board.findTask("task-1");
    expect(task.name).toBe("Fix bug");
  });

  it("throws when task not found", () => {
    const board = buildBoardState();
    expect(() => board.findTask("nonexistent")).toThrow(
      'Task "nonexistent" not found on board "Project Alpha"'
    );
  });

  it("returns a Task with update capability", () => {
    const board = buildBoardState();
    const task = board.findTask("task-1");
    expect(task).toBeInstanceOf(Task);
    expect(typeof task.update).toBe("function");
  });
});

describe("BoardState.findLabel", () => {
  it("finds a label by exact name", () => {
    const board = buildBoardState();
    const label = board.findLabel("Bug");
    expect(label.id).toBe("l1");
  });

  it("finds a label by partial name (case-insensitive)", () => {
    const board = buildBoardState();
    const label = board.findLabel("enhance");
    expect(label.id).toBe("l2");
  });

  it("throws when label not found", () => {
    const board = buildBoardState();
    expect(() => board.findLabel("Nonexistent")).toThrow(
      'Label "Nonexistent" not found on board "Project Alpha"'
    );
  });
});
