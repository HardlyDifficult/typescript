import { describe, expect, it, vi } from "vitest";
import { FullState } from "../src/FullState.js";
import { Project } from "../src/Project.js";
import { Task } from "../src/Task.js";
import type { TaskContext, TaskData } from "../src/types.js";

const mockCtx: TaskContext = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
  resolveStatusId: vi.fn(),
  resolveStatusName: vi.fn((id: string) =>
    id === "s1" ? "To Do" : id === "s2" ? "Done" : id === "s3" ? "Backlog" : "Unknown"
  ),
  resolveLabelId: vi.fn(),
};

const taskData1: TaskData = {
  id: "task-1",
  name: "Fix bug",
  description: "",
  statusId: "s1",
  projectId: "p1",
  labels: [],
  url: "https://example.com/t/1",
};

const taskData2: TaskData = {
  id: "task-2",
  name: "Add feature",
  description: "",
  statusId: "s3",
  projectId: "p2",
  labels: [],
  url: "https://example.com/t/2",
};

function buildFullState() {
  const projectAlpha = new Project(
    { id: "p1", name: "Project Alpha", url: "https://example.com/p/1" },
    [
      { id: "s1", name: "To Do" },
      { id: "s2", name: "Done" },
    ],
    [new Task(taskData1, mockCtx)],
    [{ id: "l1", name: "Bug" }],
    mockCtx
  );

  const projectBeta = new Project(
    { id: "p2", name: "Project Beta", url: "https://example.com/p/2" },
    [{ id: "s3", name: "Backlog" }],
    [new Task(taskData2, mockCtx)],
    [],
    mockCtx
  );

  return new FullState([projectAlpha, projectBeta]);
}

describe("FullState.findProject", () => {
  it("finds a project by exact name", () => {
    const state = buildFullState();
    const project = state.findProject("Project Alpha");
    expect(project.id).toBe("p1");
  });

  it("finds a project by partial name (case-insensitive)", () => {
    const state = buildFullState();
    const project = state.findProject("beta");
    expect(project.id).toBe("p2");
  });

  it("throws when project not found", () => {
    const state = buildFullState();
    expect(() => state.findProject("Nonexistent")).toThrow(
      'Project "Nonexistent" not found'
    );
  });

  it("returns Project for chaining", () => {
    const state = buildFullState();
    const project = state.findProject("Alpha");
    expect(project).toBeInstanceOf(Project);
  });
});

describe("FullState.findTask", () => {
  it("finds a task across projects", () => {
    const state = buildFullState();
    const task = state.findTask("task-2");
    expect(task.name).toBe("Add feature");
    expect(task.projectId).toBe("p2");
  });

  it("throws when task not found on any project", () => {
    const state = buildFullState();
    expect(() => state.findTask("nonexistent")).toThrow(
      'Task "nonexistent" not found in any project'
    );
  });
});
