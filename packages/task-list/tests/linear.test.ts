import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FullState } from "../src/FullState.js";
import { Project } from "../src/Project.js";
import { Task } from "../src/Task.js";
import { LinearTaskListClient } from "../src/linear/index.js";

const mockFetch = vi.fn();

function graphqlResponse(data: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve({ data }),
  } as Response;
}

function graphqlErrorResponse(message: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ data: null, errors: [{ message }] }),
  } as Response;
}

function httpErrorResponse(status: number, text: string) {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(text),
  } as Response;
}

// --- Mock Linear data ---

const linearState1 = { id: "ws1", name: "Todo" };
const linearState2 = { id: "ws2", name: "In Progress" };
const linearState3 = { id: "ws3", name: "Done" };
const linearLabel1 = { id: "ll1", name: "Bug", color: "#ff0000" };
const linearLabel2 = { id: "ll2", name: "Feature", color: "#00ff00" };

const linearIssue = {
  id: "ISS-1",
  title: "Fix login",
  description: "Users can't log in",
  url: "https://linear.app/team/ISS-1",
  state: { id: "ws1" },
  team: { id: "team-1" },
  project: { id: "proj-1" },
  labels: { nodes: [linearLabel1] },
};

const linearIssueNoDesc = {
  ...linearIssue,
  id: "ISS-2",
  description: null,
  project: null,
  labels: { nodes: [] },
};

const linearProject = {
  id: "proj-1",
  name: "Q1 Roadmap",
  url: "https://linear.app/team/project/proj-1",
};

const teamData = {
  states: { nodes: [linearState1, linearState2, linearState3] },
  labels: { nodes: [linearLabel1, linearLabel2] },
};

describe("LinearTaskListClient", () => {
  let client: LinearTaskListClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new LinearTaskListClient({
      type: "linear",
      apiKey: "lin_test_key",
      teamId: "team-1",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Authorization header with API key", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issue: linearIssue, team: teamData })
    );
    await client.getTask("ISS-1");

    const headers = (mockFetch.mock.calls[0]![1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("lin_test_key");
  });

  it("sends POST to Linear GraphQL endpoint", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issue: linearIssue, team: teamData })
    );
    await client.getTask("ISS-1");

    expect(mockFetch.mock.calls[0]![0]).toBe(
      "https://api.linear.app/graphql"
    );
    expect((mockFetch.mock.calls[0]![1] as RequestInit).method).toBe("POST");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(httpErrorResponse(401, "Unauthorized"));
    await expect(client.getTask("ISS-1")).rejects.toThrow(
      "Linear API error: 401 Unauthorized"
    );
  });

  it("throws on GraphQL error", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlErrorResponse("Issue not found")
    );
    await expect(client.getTask("ISS-1")).rejects.toThrow(
      "Linear API error: Issue not found"
    );
  });

  describe("getTask", () => {
    it("maps Linear issue to Task with resolved field names", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );
      const task = await client.getTask("ISS-1");

      expect(task).toBeInstanceOf(Task);
      expect(task.id).toBe("ISS-1");
      expect(task.name).toBe("Fix login");
      expect(task.description).toBe("Users can't log in");
      expect(task.status).toBe("Todo");
      expect(task.projectId).toBe("proj-1");
      expect(task.labels).toEqual(["Bug"]);
      expect(task.url).toBe("https://linear.app/team/ISS-1");
    });

    it("maps null description to empty string", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssueNoDesc, team: teamData })
      );
      const task = await client.getTask("ISS-2");

      expect(task.description).toBe("");
    });

    it("maps null project to empty projectId", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssueNoDesc, team: teamData })
      );
      const task = await client.getTask("ISS-2");

      expect(task.projectId).toBe("");
    });

    it("returns a Task with working update()", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );
      const task = await client.getTask("ISS-1");

      const updatedIssue = {
        ...linearIssue,
        title: "Updated title",
        state: { id: "ws3" },
      };
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueUpdate: { issue: updatedIssue } })
      );
      const updated = await task.update({
        name: "Updated title",
        status: "Done",
      });

      expect(updated).toBeInstanceOf(Task);
      expect(updated.name).toBe("Updated title");
      expect(updated.status).toBe("Done");
    });

    it("update() sends correct mutation variables", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );
      const task = await client.getTask("ISS-1");

      const updatedIssue = { ...linearIssue, state: { id: "ws2" } };
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueUpdate: { issue: updatedIssue } })
      );
      await task.update({ status: "In Progress", labels: ["Feature"] });

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { id: string; input: Record<string, unknown> } };
      expect(body.variables.id).toBe("ISS-1");
      expect(body.variables.input.stateId).toBe("ws2");
      expect(body.variables.input.labelIds).toEqual(["ll2"]);
    });
  });

  describe("getProject", () => {
    it("returns a Project with statuses, tasks, and labels as strings", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          organization: { urlKey: "myorg" },
          project: {
            ...linearProject,
            issues: { nodes: [linearIssue] },
          },
          team: teamData,
        })
      );
      const project = await client.getProject("proj-1");

      expect(project).toBeInstanceOf(Project);
      expect(project.id).toBe("proj-1");
      expect(project.name).toBe("Q1 Roadmap");
      expect(project.statuses).toEqual(["Todo", "In Progress", "Done"]);
      expect(project.labels).toEqual(["Bug", "Feature"]);
      expect(project.tasks).toHaveLength(1);
      expect(project.tasks[0]!.status).toBe("Todo");
    });

    it("createTask sends correct mutation with teamId", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          organization: { urlKey: "myorg" },
          project: {
            ...linearProject,
            issues: { nodes: [] },
          },
          team: teamData,
        })
      );
      const project = await client.getProject("proj-1");

      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueCreate: { issue: linearIssue } })
      );
      await project.createTask("Fix login", {
        description: "Users can't log in",
        status: "In Progress",
        labels: ["Bug"],
      });

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { input: Record<string, unknown> } };
      expect(body.variables.input.teamId).toBe("team-1");
      expect(body.variables.input.stateId).toBe("ws2");
      expect(body.variables.input.projectId).toBe("proj-1");
      expect(body.variables.input.title).toBe("Fix login");
      expect(body.variables.input.description).toBe("Users can't log in");
      expect(body.variables.input.labelIds).toEqual(["ll1"]);
    });

    it("createTask uses default status when not specified", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          organization: { urlKey: "myorg" },
          project: {
            ...linearProject,
            issues: { nodes: [] },
          },
          team: teamData,
        })
      );
      const project = await client.getProject("proj-1");

      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueCreate: { issue: linearIssue } })
      );
      await project.createTask("Simple task");

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { input: Record<string, unknown> } };
      expect(body.variables.input.stateId).toBe("ws1");
    });
  });

  describe("getProjects", () => {
    it("returns a FullState with all projects", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          organization: { urlKey: "myorg" },
          team: {
            ...teamData,
            projects: {
              nodes: [
                {
                  ...linearProject,
                  issues: { nodes: [linearIssue] },
                },
              ],
            },
          },
        })
      );
      const state = await client.getProjects();

      expect(state).toBeInstanceOf(FullState);
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0]!.name).toBe("Q1 Roadmap");
      expect(state.projects[0]!.tasks).toHaveLength(1);
    });

    it("supports chaining: findProject → createTask", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          organization: { urlKey: "myorg" },
          team: {
            ...teamData,
            projects: {
              nodes: [
                {
                  ...linearProject,
                  issues: { nodes: [] },
                },
              ],
            },
          },
        })
      );
      const state = await client.getProjects();
      const project = state.findProject("Q1 Roadmap");

      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueCreate: { issue: linearIssue } })
      );
      const task = await project.createTask("New task");
      expect(task).toBeInstanceOf(Task);
    });
  });

  it("uses LINEAR_API_KEY env var when apiKey not provided", async () => {
    const original = process.env.LINEAR_API_KEY;
    process.env.LINEAR_API_KEY = "env_key";
    const envClient = new LinearTaskListClient({
      type: "linear",
      teamId: "team-1",
    });

    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issue: linearIssue, team: teamData })
    );
    await envClient.getTask("ISS-1");

    const headers = (mockFetch.mock.calls[0]![1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("env_key");
    process.env.LINEAR_API_KEY = original;
  });
});
