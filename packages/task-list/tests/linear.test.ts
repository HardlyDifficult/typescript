import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Project } from "../src/Project.js";
import { Task } from "../src/Task.js";
import {
  LinearGraphQLError,
  MultipleTeamsFoundError,
  NoTeamsFoundError,
  TaskListApiError,
  TeamNotFoundError,
} from "../src/errors.js";
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
  priority: 2,
  state: { id: "ws1" },
  team: { id: "team-1" },
  project: { id: "proj-1" },
  labels: { nodes: [linearLabel1] },
};

const linearIssueNoDesc = {
  ...linearIssue,
  id: "ISS-2",
  description: null,
  priority: 0,
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
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new LinearTaskListClient({
      type: "linear",
      apiKey: "lin_test_key",
      teamId: "team-1",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

    expect(mockFetch.mock.calls[0]![0]).toBe("https://api.linear.app/graphql");
    expect((mockFetch.mock.calls[0]![1] as RequestInit).method).toBe("POST");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(httpErrorResponse(401, "Unauthorized"));
    const error = await client.getTask("ISS-1").catch((e) => e);
    expect(error).toBeInstanceOf(TaskListApiError);
    expect((error as TaskListApiError).code).toBe("API_ERROR");
  });

  it("throws on GraphQL error", async () => {
    mockFetch.mockResolvedValueOnce(graphqlErrorResponse("Issue not found"));
    const error = await client.getTask("ISS-1").catch((e) => e);
    expect(error).toBeInstanceOf(LinearGraphQLError);
    expect((error as LinearGraphQLError).code).toBe("LINEAR_GRAPHQL_ERROR");
  });

  describe("team resolution", () => {
    it("skips when teamId is provided", async () => {
      await client.resolveTeam();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("auto-detects single team", async () => {
      const noTeamClient = new LinearTaskListClient({
        type: "linear",
        apiKey: "lin_test_key",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          teams: { nodes: [{ id: "team-1", name: "MyTeam" }] },
        })
      );
      await noTeamClient.resolveTeam();

      // Verify it works — make a request
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );
      const taskPromise = noTeamClient.getTask("ISS-1");
      await vi.runAllTimersAsync();
      const task = await taskPromise;
      expect(task.id).toBe("ISS-1");
    });

    it("resolves team by friendly name", async () => {
      const namedClient = new LinearTaskListClient({
        type: "linear",
        apiKey: "lin_test_key",
        team: "MyTeam",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          teams: {
            nodes: [
              { id: "team-1", name: "MyTeam" },
              { id: "team-2", name: "OtherTeam" },
            ],
          },
        })
      );
      await namedClient.resolveTeam();

      // Verify correct team was picked by making a request
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );
      const taskPromise = namedClient.getTask("ISS-1");
      await vi.runAllTimersAsync();
      await taskPromise;

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { teamId: string } };
      expect(body.variables.teamId).toBe("team-1");
    });

    it("throws for multiple teams without specifier", async () => {
      const ambiguousClient = new LinearTaskListClient({
        type: "linear",
        apiKey: "lin_test_key",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          teams: {
            nodes: [
              { id: "team-1", name: "TeamA" },
              { id: "team-2", name: "TeamB" },
            ],
          },
        })
      );
      const error = await ambiguousClient.resolveTeam().catch((e) => e);
      expect(error).toBeInstanceOf(MultipleTeamsFoundError);
      expect((error as MultipleTeamsFoundError).code).toBe(
        "MULTIPLE_TEAMS_FOUND"
      );
    });

    it("throws when team name not found", async () => {
      const badNameClient = new LinearTaskListClient({
        type: "linear",
        apiKey: "lin_test_key",
        team: "NonExistent",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          teams: { nodes: [{ id: "team-1", name: "MyTeam" }] },
        })
      );
      const error = await badNameClient.resolveTeam().catch((e) => e);
      expect(error).toBeInstanceOf(TeamNotFoundError);
      expect((error as TeamNotFoundError).code).toBe("TEAM_NOT_FOUND");
    });

    it("throws when no teams exist", async () => {
      const emptyClient = new LinearTaskListClient({
        type: "linear",
        apiKey: "lin_test_key",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ teams: { nodes: [] } })
      );
      const error = await emptyClient.resolveTeam().catch((e) => e);
      expect(error).toBeInstanceOf(NoTeamsFoundError);
      expect((error as NoTeamsFoundError).code).toBe("NO_TEAMS_FOUND");
    });
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

    it("maps priority number to friendly name", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );
      const task = await client.getTask("ISS-1");
      expect(task.priority).toBe("High");
    });

    it("maps priority 0 to None", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssueNoDesc, team: teamData })
      );
      const task = await client.getTask("ISS-2");
      expect(task.priority).toBe("None");
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
      const updatePromise = task.update({
        name: "Updated title",
        status: "Done",
      });
      await vi.runAllTimersAsync();
      const updated = await updatePromise;

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
      const updatePromise = task.update({
        status: "In Progress",
        labels: ["Feature"],
      });
      await vi.runAllTimersAsync();
      await updatePromise;

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { id: string; input: Record<string, unknown> } };
      expect(body.variables.id).toBe("ISS-1");
      expect(body.variables.input.stateId).toBe("ws2");
      expect(body.variables.input.labelIds).toEqual(["ll2"]);
    });

    it("update() sends priority in mutation", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );
      const task = await client.getTask("ISS-1");

      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          issueUpdate: { issue: { ...linearIssue, priority: 1 } },
        })
      );
      const updatePromise = task.update({ priority: "Urgent" });
      await vi.runAllTimersAsync();
      await updatePromise;

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { input: Record<string, unknown> } };
      expect(body.variables.input.priority).toBe(1);
    });
  });

  describe("getProject", () => {
    it("returns a Project with Status and Label objects", async () => {
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
      expect(project.statuses).toEqual([
        { id: "ws1", name: "Todo" },
        { id: "ws2", name: "In Progress" },
        { id: "ws3", name: "Done" },
      ]);
      expect(project.labels).toEqual([
        { id: "ll1", name: "Bug", color: "#ff0000" },
        { id: "ll2", name: "Feature", color: "#00ff00" },
      ]);
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
      const createPromise = project.createTask("Fix login", {
        description: "Users can't log in",
        status: "In Progress",
        labels: ["Bug"],
      });
      await vi.runAllTimersAsync();
      await createPromise;

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

    it("createTask sends priority in mutation", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          organization: { urlKey: "myorg" },
          project: { ...linearProject, issues: { nodes: [] } },
          team: teamData,
        })
      );
      const project = await client.getProject("proj-1");

      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueCreate: { issue: linearIssue } })
      );
      const createPromise = project.createTask("Urgent fix", {
        priority: "High",
      });
      await vi.runAllTimersAsync();
      await createPromise;

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { input: Record<string, unknown> } };
      expect(body.variables.input.priority).toBe(2);
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
      const createPromise = project.createTask("Simple task");
      await vi.runAllTimersAsync();
      await createPromise;

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { input: Record<string, unknown> } };
      expect(body.variables.input.stateId).toBe("ws1");
    });
  });

  describe("getProjects", () => {
    it("returns Project[] with all projects", async () => {
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
      const projects = await client.getProjects();

      expect(projects).toBeInstanceOf(Array);
      expect(projects).toHaveLength(1);
      expect(projects[0]!.name).toBe("Q1 Roadmap");
      expect(projects[0]!.tasks).toHaveLength(1);
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
      const projects = await client.getProjects();
      const project = projects.find((p) => p.name === "Q1 Roadmap")!;

      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueCreate: { issue: linearIssue } })
      );
      const createPromise = project.createTask("New task");
      await vi.runAllTimersAsync();
      const task = await createPromise;
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
