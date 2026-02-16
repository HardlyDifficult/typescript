import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FullState } from "../src/FullState.js";
import { Project } from "../src/Project.js";
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
const trelloListDone = { id: "l2", name: "Done", idBoard: "b1" };
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
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new TrelloTaskListClient({
      type: "trello",
      apiKey: "test-key",
      token: "test-token",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("appends auth params to all requests", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloList]));
    mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
    const promise = client.getTask("c1");
    await vi.runAllTimersAsync();
    await promise;

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
    it("maps Trello card to Task with resolved status name", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      mockFetch.mockResolvedValueOnce(
        jsonResponse([trelloList, trelloListDone])
      );
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
      const promise = client.getTask("c1");
      await vi.runAllTimersAsync();
      const task = await promise;

      expect(task).toBeInstanceOf(Task);
      expect(task.id).toBe("c1");
      expect(task.name).toBe("Fix bug");
      expect(task.description).toBe("A description");
      expect(task.status).toBe("To Do");
      expect(task.projectId).toBe("b1");
      expect(task.labels).toEqual(["Bug"]);
      expect(task.url).toBe("https://trello.com/c/c1");
    });

    it("returns a Task with working update()", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      mockFetch.mockResolvedValueOnce(
        jsonResponse([trelloList, trelloListDone])
      );
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
      const getPromise = client.getTask("c1");
      await vi.runAllTimersAsync();
      const task = await getPromise;

      const updatedCard = { ...trelloCard, name: "Updated" };
      mockFetch.mockResolvedValueOnce(jsonResponse(updatedCard));
      const updatePromise = task.update({ name: "Updated" });
      await vi.runAllTimersAsync();
      const updated = await updatePromise;

      expect(updated.name).toBe("Updated");
      expect(updated).toBeInstanceOf(Task);
    });

    it("update() resolves status name to list ID", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      mockFetch.mockResolvedValueOnce(
        jsonResponse([trelloList, trelloListDone])
      );
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
      const getPromise = client.getTask("c1");
      await vi.runAllTimersAsync();
      const task = await getPromise;

      const updatedCard = { ...trelloCard, idList: "l2" };
      mockFetch.mockResolvedValueOnce(jsonResponse(updatedCard));
      const updatePromise = task.update({ status: "Done" });
      await vi.runAllTimersAsync();
      const updated = await updatePromise;

      const updateCall = mockFetch.mock.calls.at(-1)!;
      const updateBody = JSON.parse(
        (updateCall[1] as RequestInit).body as string
      ) as Record<string, string>;
      expect(updateBody["idList"]).toBe("l2");
      expect(updated.status).toBe("Done");
    });
  });

  describe("getProject", () => {
    it("returns a Project with statuses, tasks, and labels as strings", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
      mockFetch.mockResolvedValueOnce(
        jsonResponse([trelloList, trelloListDone])
      );
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const promise = client.getProject("b1");
      await vi.runAllTimersAsync();
      const project = await promise;

      expect(project).toBeInstanceOf(Project);
      expect(project.id).toBe("b1");
      expect(project.name).toBe("My Board");
      expect(project.url).toBe("https://trello.com/b/b1");
      expect(project.statuses).toEqual(["To Do", "Done"]);
      expect(project.tasks).toHaveLength(1);
      expect(project.tasks[0]!.status).toBe("To Do");
      expect(project.labels).toEqual(["Bug"]);
    });

    it("createTask resolves status and labels by name", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
      mockFetch.mockResolvedValueOnce(
        jsonResponse([trelloList, trelloListDone])
      );
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const getPromise = client.getProject("b1");
      await vi.runAllTimersAsync();
      const project = await getPromise;

      const newCard = { ...trelloCard, id: "c2", name: "New task" };
      mockFetch.mockResolvedValueOnce(jsonResponse(newCard));
      const createPromise = project.createTask("New task", {
        description: "Task description",
        status: "Done",
        labels: ["Bug"],
      });
      await vi.runAllTimersAsync();
      const task = await createPromise;

      expect(task).toBeInstanceOf(Task);

      const createCall = mockFetch.mock.calls.at(-1)!;
      const createUrl = new URL(createCall[0] as string);
      expect(createUrl.pathname).toBe("/1/cards");
      const createBody = JSON.parse(
        (createCall[1] as RequestInit).body as string
      ) as Record<string, string>;
      expect(createBody["name"]).toBe("New task");
      expect(createBody["idList"]).toBe("l2");
      expect(createBody["desc"]).toBe("Task description");
      expect(createBody["idLabels"]).toBe("lb1");
    });

    it("createTask uses default status when not specified", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloBoard));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloList]));
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      const getPromise = client.getProject("b1");
      await vi.runAllTimersAsync();
      const project = await getPromise;

      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      const createPromise = project.createTask("Simple task");
      await vi.runAllTimersAsync();
      const task = await createPromise;

      expect(task).toBeInstanceOf(Task);
      const createCall = mockFetch.mock.calls.at(-1)!;
      const createBody = JSON.parse(
        (createCall[1] as RequestInit).body as string
      ) as Record<string, string>;
      expect(createBody["idList"]).toBe("l1");
    });
  });

  describe("getProjects", () => {
    it("returns a FullState with all projects", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloBoard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloList]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const promise = client.getProjects();
      await vi.runAllTimersAsync();
      const state = await promise;

      expect(state).toBeInstanceOf(FullState);
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0]!.name).toBe("My Board");
    });

    it("supports chaining: findProject → createTask", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloBoard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloList]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloCard]));
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));

      const getPromise = client.getProjects();
      await vi.runAllTimersAsync();
      const state = await getPromise;
      const project = state.findProject("My Board");

      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      const createPromise = project.createTask("Chained task");
      await vi.runAllTimersAsync();
      const task = await createPromise;
      expect(task).toBeInstanceOf(Task);
    });
  });

  describe("create and update via Trello API", () => {
    it("updateTask sends correct Trello API body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(trelloCard));
      mockFetch.mockResolvedValueOnce(
        jsonResponse([trelloList, trelloListDone])
      );
      mockFetch.mockResolvedValueOnce(jsonResponse([trelloLabel]));
      const getPromise = client.getTask("c1");
      await vi.runAllTimersAsync();
      const task = await getPromise;

      const updatedCard = {
        ...trelloCard,
        name: "Updated",
        idList: "l2",
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(updatedCard));

      const updatePromise = task.update({
        name: "Updated",
        status: "Done",
      });
      await vi.runAllTimersAsync();
      await updatePromise;

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
