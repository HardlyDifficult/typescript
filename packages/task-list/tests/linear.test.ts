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

const linearStates = [
  { id: "ws1", name: "Todo" },
  { id: "ws2", name: "In Progress" },
  { id: "ws3", name: "Done" },
];
const linearLabels = [
  { id: "ll1", name: "Bug", color: "#ff0000" },
  { id: "ll2", name: "Feature", color: "#00ff00" },
];

const linearIssue = {
  id: "ISS-1",
  title: "Fix login",
  description: "Users cannot log in",
  url: "https://linear.app/team/ISS-1",
  priority: 2,
  state: { id: "ws1" },
  team: { id: "team-1" },
  project: { id: "proj-1" },
  labels: { nodes: [linearLabels[0]!] },
};

const linearIssueNoProject = {
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
  states: { nodes: linearStates },
  labels: { nodes: linearLabels },
};

describe("LinearTaskListClient", () => {
  let client: LinearTaskListClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new LinearTaskListClient({
      provider: "linear",
      apiKey: "lin_test_key",
      teamId: "team-1",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends Authorization header with the API key", async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlResponse({ issue: linearIssue, team: teamData })
    );

    await client.getTask("ISS-1");

    const headers = (mockFetch.mock.calls[0]![1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("lin_test_key");
  });

  it("throws on HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce(httpErrorResponse(401, "Unauthorized"));

    await expect(client.getTask("ISS-1")).rejects.toBeInstanceOf(
      TaskListApiError
    );
  });

  it("throws on GraphQL errors", async () => {
    mockFetch.mockResolvedValueOnce(graphqlErrorResponse("Issue not found"));

    await expect(client.getTask("ISS-1")).rejects.toBeInstanceOf(
      LinearGraphQLError
    );
  });

  describe("team resolution", () => {
    it("skips resolution when teamId is provided", async () => {
      await client.resolveTeam();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("auto-detects a single team", async () => {
      const noTeamClient = new LinearTaskListClient({
        provider: "linear",
        apiKey: "lin_test_key",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          teams: { nodes: [{ id: "team-1", name: "Core" }] },
        })
      );
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );

      const task = await noTeamClient.getTask("ISS-1");

      expect(task.id).toBe("ISS-1");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("resolves the team by exact case-insensitive name", async () => {
      const namedClient = new LinearTaskListClient({
        provider: "linear",
        apiKey: "lin_test_key",
        team: "core",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          teams: {
            nodes: [
              { id: "team-1", name: "Core" },
              { id: "team-2", name: "Other" },
            ],
          },
        })
      );
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );

      await namedClient.getTask("ISS-1");

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { teamId: string } };
      expect(body.variables.teamId).toBe("team-1");
    });

    it("throws when multiple teams exist and none is specified", async () => {
      const ambiguousClient = new LinearTaskListClient({
        provider: "linear",
        apiKey: "lin_test_key",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          teams: {
            nodes: [
              { id: "team-1", name: "Core" },
              { id: "team-2", name: "Ops" },
            ],
          },
        })
      );

      await expect(ambiguousClient.getTask("ISS-1")).rejects.toBeInstanceOf(
        MultipleTeamsFoundError
      );
    });

    it("throws when the named team does not exist", async () => {
      const missingTeamClient = new LinearTaskListClient({
        provider: "linear",
        apiKey: "lin_test_key",
        team: "Missing",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          teams: { nodes: [{ id: "team-1", name: "Core" }] },
        })
      );

      await expect(missingTeamClient.getTask("ISS-1")).rejects.toBeInstanceOf(
        TeamNotFoundError
      );
    });

    it("throws when no teams exist", async () => {
      const emptyClient = new LinearTaskListClient({
        provider: "linear",
        apiKey: "lin_test_key",
      });
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ teams: { nodes: [] } })
      );

      await expect(emptyClient.getTask("ISS-1")).rejects.toBeInstanceOf(
        NoTeamsFoundError
      );
    });
  });

  describe("getTask", () => {
    it("maps a Linear issue into a stateful Task", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );

      const task = await client.getTask("ISS-1");

      expect(task).toBeInstanceOf(Task);
      expect(task.id).toBe("ISS-1");
      expect(task.title).toBe("Fix login");
      expect(task.description).toBe("Users cannot log in");
      expect(task.status).toBe("Todo");
      expect(task.projectId).toBe("proj-1");
      expect(task.labels).toEqual(["Bug"]);
      expect(task.priority).toBe("High");
    });

    it("maps null description and project to empty strings", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssueNoProject, team: teamData })
      );

      const task = await client.getTask("ISS-2");

      expect(task.description).toBe("");
      expect(task.projectId).toBe("");
      expect(task.priority).toBe("None");
    });

    it("update() mutates the current task and sends resolved ids", async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: linearIssue, team: teamData })
      );
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          issueUpdate: {
            issue: {
              ...linearIssue,
              title: "Updated title",
              state: { id: "ws2" },
              labels: { nodes: [linearLabels[1]!] },
            },
          },
        })
      );

      const task = await client.getTask("ISS-1");
      const updated = await task.update({
        title: "Updated title",
        status: "In Progress",
        labels: ["Feature"],
      });

      expect(updated).toBe(task);
      expect(task.title).toBe("Updated title");
      expect(task.status).toBe("In Progress");

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { id: string; input: Record<string, unknown> } };
      expect(body.variables.id).toBe("ISS-1");
      expect(body.variables.input.stateId).toBe("ws2");
      expect(body.variables.input.labelIds).toEqual(["ll2"]);
    });
  });

  describe("getProject", () => {
    it("returns a Project with stateful tasks", async () => {
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
      expect(project.name).toBe("Q1 Roadmap");
      expect(project.statuses).toEqual(linearStates);
      expect(project.labels).toEqual(linearLabels);
      expect(project.tasks()).toHaveLength(1);
      expect(project.tasks()[0]!.title).toBe("Fix login");
    });

    it("createTask() sends the correct Linear mutation", async () => {
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
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueCreate: { issue: linearIssue } })
      );

      const project = await client.getProject("proj-1");
      const task = await project.createTask({
        title: "Fix login",
        description: "Users cannot log in",
        status: "In Progress",
        labels: ["Bug"],
        priority: "High",
      });

      expect(task.title).toBe("Fix login");

      const body = JSON.parse(
        (mockFetch.mock.calls[1]![1] as RequestInit).body as string
      ) as { variables: { input: Record<string, unknown> } };
      expect(body.variables.input.teamId).toBe("team-1");
      expect(body.variables.input.projectId).toBe("proj-1");
      expect(body.variables.input.stateId).toBe("ws2");
      expect(body.variables.input.title).toBe("Fix login");
      expect(body.variables.input.labelIds).toEqual(["ll1"]);
      expect(body.variables.input.priority).toBe(2);
    });
  });
});
