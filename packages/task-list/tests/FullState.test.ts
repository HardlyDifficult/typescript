import { describe, expect, it, vi } from "vitest";
import { BoardState } from "../src/BoardState.js";
import { FullState } from "../src/FullState.js";
import { Task } from "../src/Task.js";
import { TaskList } from "../src/TaskList.js";
import type { TaskOperations } from "../src/types.js";

const mockOps: TaskOperations = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
};

function buildFullState() {
  const boardAlpha = new BoardState(
    { id: "board-1", name: "Project Alpha", url: "https://example.com/b/1" },
    [
      new TaskList(
        { id: "list-1", name: "To Do", boardId: "board-1" },
        mockOps
      ),
      new TaskList({ id: "list-2", name: "Done", boardId: "board-1" }, mockOps),
    ],
    [
      new Task(
        {
          id: "task-1",
          name: "Fix bug",
          description: "",
          listId: "list-1",
          boardId: "board-1",
          labels: [],
          url: "https://example.com/t/1",
        },
        mockOps
      ),
    ],
    [{ id: "l1", name: "Bug", color: "red" }]
  );

  const boardBeta = new BoardState(
    { id: "board-2", name: "Project Beta", url: "https://example.com/b/2" },
    [
      new TaskList(
        { id: "list-3", name: "Backlog", boardId: "board-2" },
        mockOps
      ),
    ],
    [
      new Task(
        {
          id: "task-2",
          name: "Add feature",
          description: "",
          listId: "list-3",
          boardId: "board-2",
          labels: [],
          url: "https://example.com/t/2",
        },
        mockOps
      ),
    ],
    []
  );

  return new FullState([boardAlpha, boardBeta]);
}

describe("FullState.findBoard", () => {
  it("finds a board by exact name", () => {
    const state = buildFullState();
    const board = state.findBoard("Project Alpha");
    expect(board.board.id).toBe("board-1");
  });

  it("finds a board by partial name (case-insensitive)", () => {
    const state = buildFullState();
    const board = state.findBoard("beta");
    expect(board.board.id).toBe("board-2");
  });

  it("throws when board not found", () => {
    const state = buildFullState();
    expect(() => state.findBoard("Nonexistent")).toThrow(
      'Board "Nonexistent" not found'
    );
  });

  it("returns BoardState for chaining", () => {
    const state = buildFullState();
    const board = state.findBoard("Alpha");
    expect(board).toBeInstanceOf(BoardState);
  });
});

describe("chaining: findBoard → findList", () => {
  it("chains findBoard and findList", () => {
    const state = buildFullState();
    const list = state.findBoard("Alpha").findList("To Do");
    expect(list.id).toBe("list-1");
  });

  it("chains findBoard and findLabel", () => {
    const state = buildFullState();
    const label = state.findBoard("Alpha").findLabel("Bug");
    expect(label.id).toBe("l1");
  });

  it("throws on findList when list not on found board", () => {
    const state = buildFullState();
    expect(() => state.findBoard("Alpha").findList("Backlog")).toThrow(
      'List "Backlog" not found on board "Project Alpha"'
    );
  });
});

describe("FullState.findTask", () => {
  it("finds a task across boards", () => {
    const state = buildFullState();
    const task = state.findTask("task-2");
    expect(task.name).toBe("Add feature");
    expect(task.boardId).toBe("board-2");
  });

  it("throws when task not found on any board", () => {
    const state = buildFullState();
    expect(() => state.findTask("nonexistent")).toThrow(
      'Task "nonexistent" not found on any board'
    );
  });
});
