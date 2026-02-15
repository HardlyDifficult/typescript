import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardState } from "../src/BoardState.js";
import { FullState } from "../src/FullState.js";
import { Task } from "../src/Task.js";
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
  id: "b1",
  name: "My Board",
  url: "https://trello.com/b/b1",
};
const trelloList = { id: "l1", name: "To Do", idBoard: "b1" };
const trelloLabel = { id: "lb1", name: "Bug", color: "red" };
const trelloCard = {
  id: "c1",
  name: "Fix bug",
  desc: "A description",
  idList: "l1",
  idBoard: "b1",
  idLabels: ["lb1"],
  labels: [trelloLabel],
  url: "https://trello.com/c/c1",
};

describe("TrelloTaskListClient", () => {
  let client: TrelloTaskListClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new TrelloTaskListClient({
      type: "trello",
      apiKey: "test-key",
      token: "test-token",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("appends auth params to all requests", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
    await client.getTask("c1");

    const calledUrl = new URL(mockFetch.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("key")).toBe("test-key");
    expect(calledUrl.searchParams.get("token")).toBe("test-token");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, "unauthorized"));
    await expect(client.getTask("c1")).rejects.toThrow(
      "Trello API error: 401 unauthorized"
    );
  });

  describe("getTask", () => {
    it("maps Trello card to Task with agnostic field names", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      const task = await client.getTask("c1");

      expect(task).toBeInstanceOf(Task);
      expect(task.id).toBe("c1");
      expect(task.name).toBe("Fix bug");
      expect(task.description).toBe("A description");
      expect(task.listId).toBe("l1");
      expect(task.boardId).toBe("b1");
      expect(task.labels).toEqual([{ id: "lb1", name: "Bug", color: "red" }]);
      expect(task.url).toBe("https://trello.com/c/c1");
    });

    it("returns a Task with working update()", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      const task = await client.getTask("c1");

      const updatedCard = { ...trelloCard, name: "Updated" };
      mockFetch.mockResolvedValueOnce(jsonResponse(updatedCard));
      const updated = await task.update({ name: "Updated" });

      expect(updated.name).toBe("Updated");
      expect(updated).toBeInstanceOf(Task);
    });
  });

  describe("getBoard", () => {
    it("returns a BoardState with lists, tasks, and labels", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloList]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const board = await client.getBoard("b1");

      expect(board).toBeInstanceOf(BoardState);
      expect(board.board.id).toBe("b1");
      expect(board.board.name).toBe("My Board");
      expect(board.lists).toHaveLength(1);
      expect(board.lists[0]!.name).toBe("To Do");
      expect(board.lists[0]!.boardId).toBe("b1");
      expect(board.tasks).toHaveLength(1);
      expect(board.tasks[0]!.description).toBe("A description");
      expect(board.labels).toHaveLength(1);
    });

    it("returns lists with createTask capability", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloList]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const board = await client.getBoard("b1");
      const list = board.findList("To Do");

      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      const task = await list.createTask("New task");
      expect(task).toBeInstanceOf(Task);
    });
  });

  describe("getBoards", () => {
    it("returns a FullState with all boards", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloBoard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloList]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const state = await client.getBoards();

      expect(state).toBeInstanceOf(FullState);
      expect(state.boards).toHaveLength(1);
      expect(state.boards[0]!.board.name).toBe("My Board");
    });

    it("supports chaining: findBoard → findList → createTask", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloBoard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloList]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const state = await client.getBoards();
      const list = state.findBoard("My Board").findList("To Do");

      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      const task = await list.createTask("Chained task");
      expect(task).toBeInstanceOf(Task);
    });
  });

  describe("create and update via Trello API", () => {
    it("createTask sends correct Trello API body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      const task = await client.getTask("c1");

      // Now create via a list
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloList]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
      const board = await client.getBoard("b1");

      const newCard = { ...trelloCard, id: "c2", name: "New task" };
      mockFetch.mockResolvedValueOnce(jsonResponse(newCard));
      const label = board.findLabel("Bug");
      await board.findList("To Do").createTask("New task", {
        description: "Task description",
        labels: [label],
      });

      const createCall = mockFetch.mock.calls.at(-1)!;
      const createUrl = new URL(createCall[0] as string);
      expect(createUrl.pathname).toBe("/1/cards");
      const createBody = JSON.parse(
        (createCall[1] as RequestInit).body as string
      ) as Record<string, string>;
      expect(createBody["name"]).toBe("New task");
      expect(createBody["idList"]).toBe("l1");
      expect(createBody["desc"]).toBe("Task description");
      expect(createBody["idLabels"]).toBe("lb1");
    });

    it("updateTask sends correct Trello API body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      const task = await client.getTask("c1");

      const updatedCard = {
        ...trelloCard,
        name: "Updated",
        idList: "l2",
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(updatedCard));

      await task.update({
        name: "Updated",
        list: { id: "l2" },
      });

      const updateCall = mockFetch.mock.calls.at(-1)!;
      const updateUrl = new URL(updateCall[0] as string);
      expect(updateUrl.pathname).toBe("/1/cards/c1");
      expect((updateCall[1] as RequestInit).method).toBe("PUT");
      const updateBody = JSON.parse(
        (updateCall[1] as RequestInit).body as string
      ) as Record<string, string>;
      expect(updateBody["name"]).toBe("Updated");
      expect(updateBody["idList"]).toBe("l2");
    });
  });
});
