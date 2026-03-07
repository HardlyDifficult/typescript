import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Project } from "../src/Project.js";
import { Task } from "../src/Task.js";
import { TaskListApiError } from "../src/errors.js";
import { TrelloTaskListClient } from "../src/trello/TrelloTaskListClient.js";

const mockFetch = vi.fn();

function jsonResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) } as Response;
}

function errorResponse(status: number, text: string) {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(text),
  } as Response;
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

describe("TrelloTaskListClient", () => {
  let client: TrelloTaskListClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new TrelloTaskListClient({
      provider: "trello",
      apiKey: "test-key",
      token: "test-token",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("appends auth params to every request", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLists[0]]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

    await client.getTask("card-1");

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("key")).toBe("test-key");
    expect(calledUrl.searchParams.get("token")).toBe("test-token");
  });

  it("throws on API errors", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, "unauthorized"));

    await expect(client.getTask("card-1")).rejects.toBeInstanceOf(
      TaskListApiError
    );
  });

  describe("getTask", () => {
    it("maps a Trello card into a stateful Task", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const task = await client.getTask("card-1");

      expect(task).toBeInstanceOf(Task);
      expect(task.id).toBe("card-1");
      expect(task.title).toBe("Fix bug");
      expect(task.description).toBe("A description");
      expect(task.status).toBe("Todo");
      expect(task.projectId).toBe("board-1");
      expect(task.labels).toEqual(["Bug"]);
    });

    it("update() mutates the current task and resolves status ids", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ...trelloCard,
          name: "Updated title",
          idList: "list-2",
        })
      );

      const task = await client.getTask("card-1");
      const updated = await task.update({
        title: "Updated title",
        status: "Done",
      });

      expect(updated).toBe(task);
      expect(task.title).toBe("Updated title");
      expect(task.status).toBe("Done");

      const updateCall = mockFetch.mock.calls.at(-1)!;
      const body = JSON.parse(
        (updateCall[1] as RequestInit).body as string
      ) as Record<string, string>;
      expect(body["name"]).toBe("Updated title");
      expect(body["idList"]).toBe("list-2");
    });
  });

  describe("getProject", () => {
    it("returns a Project with tasks()", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const project = await client.getProject("board-1");

      expect(project).toBeInstanceOf(Project);
      expect(project.name).toBe("My Board");
      expect(project.statuses).toEqual([
        { id: "list-1", name: "Todo" },
        { id: "list-2", name: "Done" },
      ]);
      expect(project.tasks()).toHaveLength(1);
      expect(project.tasks()[0]!.title).toBe("Fix bug");
    });

    it("createTask() resolves labels and statuses", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ...trelloCard,
          id: "card-2",
          name: "New task",
          idList: "list-2",
        })
      );

      const project = await client.getProject("board-1");
      const task = await project.createTask({
        title: "New task",
        description: "Task description",
        status: "Done",
        labels: ["Bug"],
      });

      expect(task.title).toBe("New task");

      const createCall = mockFetch.mock.calls.at(-1)!;
      const createUrl = new URL(createCall[0] as string);
      expect(createUrl.pathname).toBe("/1/cards");

      const body = JSON.parse(
        (createCall[1] as RequestInit).body as string
      ) as Record<string, string>;
      expect(body["name"]).toBe("New task");
      expect(body["idList"]).toBe("list-2");
      expect(body["desc"]).toBe("Task description");
      expect(body["idLabels"]).toBe("label-1");
    });
  });

  describe("getProjects", () => {
    it("returns every project", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloBoard]));
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloLists));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const projects = await client.getProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]!.name).toBe("My Board");
    });
  });
});
