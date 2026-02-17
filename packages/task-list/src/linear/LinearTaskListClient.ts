import { Throttle } from "@hardlydifficult/throttle";

import { FullState } from "../FullState.js";
import { Project } from "../Project.js";
import { Task } from "../Task.js";
import { TaskListClient } from "../TaskListClient.js";
import type { LinearConfig, TaskContext, TaskData } from "../types.js";

const LINEAR_API_URL = "https://api.linear.app/graphql";

// --- Internal Linear API response shapes (not exported) ---

interface LinearProject {
  id: string;
  name: string;
  url: string;
}

interface LinearWorkflowState {
  id: string;
  name: string;
}

interface LinearIssueLabel {
  id: string;
  name: string;
  color: string;
}

interface LinearIssue {
  id: string;
  title: string;
  description: string | null;
  url: string;
  state: { id: string };
  team: { id: string };
  project: { id: string } | null;
  labels: { nodes: LinearIssueLabel[] };
}

// --- GraphQL response wrappers ---

interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

interface ProjectsQueryData {
  organization: { urlKey: string };
  team: {
    projects: {
      nodes: (LinearProject & {
        issues: { nodes: LinearIssue[] };
      })[];
    };
    states: { nodes: LinearWorkflowState[] };
    labels: { nodes: LinearIssueLabel[] };
  };
}

interface ProjectQueryData {
  organization: { urlKey: string };
  project: LinearProject & {
    issues: { nodes: LinearIssue[] };
  };
  team: {
    states: { nodes: LinearWorkflowState[] };
    labels: { nodes: LinearIssueLabel[] };
  };
}

interface IssueQueryData {
  issue: LinearIssue;
  team: {
    states: { nodes: LinearWorkflowState[] };
    labels: { nodes: LinearIssueLabel[] };
  };
}

interface IssueCreateData {
  issueCreate: {
    issue: LinearIssue;
  };
}

interface IssueUpdateData {
  issueUpdate: {
    issue: LinearIssue;
  };
}

// --- GraphQL query fragments ---

const ISSUE_FIELDS = `
  id title description url
  state { id }
  team { id }
  project { id }
  labels { nodes { id name color } }
`;

/**
 * Linear implementation of TaskListClient.
 * Scoped to a single team — workflow states, labels, and mutations use the configured teamId.
 */
export class LinearTaskListClient extends TaskListClient {
  private readonly apiKey: string;
  private readonly teamId: string;
  private readonly throttle = new Throttle({ unitsPerSecond: 0.4 });

  constructor(config: LinearConfig) {
    super(config);
    this.apiKey = config.apiKey ?? process.env.LINEAR_API_KEY ?? "";
    this.teamId = config.teamId;
  }

  private async request<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    await this.throttle.wait();
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Linear API error: ${String(response.status)} ${text}`);
    }

    const json = (await response.json()) as GraphQLResponse<T>;
    if (json.errors && json.errors.length > 0) {
      throw new Error(`Linear API error: ${json.errors[0].message}`);
    }

    return json.data;
  }

  // --- Mappers: Linear API shapes → platform-agnostic types ---

  private toTaskData(issue: LinearIssue): TaskData {
    return {
      id: issue.id,
      name: issue.title,
      description: issue.description ?? "",
      statusId: issue.state.id,
      projectId: issue.project?.id ?? "",
      labels: issue.labels.nodes.map((l) => ({ id: l.id, name: l.name })),
      url: issue.url,
    };
  }

  // --- Context object wired into domain classes ---

  private createContext(
    states: readonly LinearWorkflowState[],
    labels: readonly LinearIssueLabel[]
  ): TaskContext {
    return {
      createTask: async (params): Promise<TaskData> => {
        const input: Record<string, unknown> = {
          teamId: this.teamId,
          stateId: params.statusId,
          title: params.name,
        };
        if (params.projectId) {
          input.projectId = params.projectId;
        }
        if (params.description !== undefined) {
          input.description = params.description;
        }
        if (params.labelIds !== undefined && params.labelIds.length > 0) {
          input.labelIds = params.labelIds;
        }

        const result = await this.request<IssueCreateData>(
          `mutation($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              issue { ${ISSUE_FIELDS} }
            }
          }`,
          { input }
        );
        return this.toTaskData(result.issueCreate.issue);
      },

      updateTask: async (params): Promise<TaskData> => {
        const input: Record<string, unknown> = {};
        if (params.name !== undefined) {
          input.title = params.name;
        }
        if (params.description !== undefined) {
          input.description = params.description;
        }
        if (params.statusId !== undefined) {
          input.stateId = params.statusId;
        }
        if (params.labelIds !== undefined) {
          input.labelIds = params.labelIds;
        }

        const result = await this.request<IssueUpdateData>(
          `mutation($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              issue { ${ISSUE_FIELDS} }
            }
          }`,
          { id: params.taskId, input }
        );
        return this.toTaskData(result.issueUpdate.issue);
      },

      resolveStatusId: (name: string): string => {
        const lower = name.toLowerCase();
        const state = states.find((s) => s.name.toLowerCase().includes(lower));
        if (!state) {
          throw new Error(`Status "${name}" not found`);
        }
        return state.id;
      },

      resolveStatusName: (id: string): string => {
        const state = states.find((s) => s.id === id);
        if (!state) {
          throw new Error(`Status with ID "${id}" not found`);
        }
        return state.name;
      },

      resolveLabelId: (name: string): string => {
        const lower = name.toLowerCase();
        const label = labels.find((l) => l.name.toLowerCase().includes(lower));
        if (!label) {
          throw new Error(`Label "${name}" not found`);
        }
        return label.id;
      },
    };
  }

  // --- Abstract method implementations ---

  async getProjects(): Promise<FullState> {
    const data = await this.request<ProjectsQueryData>(
      `query($teamId: String!, $teamIdFilter: ID!) {
        organization { urlKey }
        team(id: $teamId) {
          projects(first: 25) {
            nodes {
              id name url
              issues(first: 50, filter: { team: { id: { eq: $teamIdFilter } } }) {
                nodes { ${ISSUE_FIELDS} }
              }
            }
          }
          states { nodes { id name } }
          labels { nodes { id name color } }
        }
      }`,
      { teamId: this.teamId, teamIdFilter: this.teamId }
    );

    const ctx = this.createContext(
      data.team.states.nodes,
      data.team.labels.nodes
    );

    const projects = data.team.projects.nodes.map((p) => {
      return new Project(
        { id: p.id, name: p.name, url: p.url },
        data.team.states.nodes.map((s) => ({ id: s.id, name: s.name })),
        p.issues.nodes.map((i) => new Task(this.toTaskData(i), ctx)),
        data.team.labels.nodes.map((l) => ({ id: l.id, name: l.name })),
        ctx
      );
    });

    return new FullState(projects);
  }

  async getProject(projectId: string): Promise<Project> {
    const data = await this.request<ProjectQueryData>(
      `query($projectId: String!, $teamId: String!, $teamIdFilter: ID!) {
        organization { urlKey }
        project(id: $projectId) {
          id name url
          issues(first: 100, filter: { team: { id: { eq: $teamIdFilter } } }) {
            nodes { ${ISSUE_FIELDS} }
          }
        }
        team(id: $teamId) {
          states { nodes { id name } }
          labels { nodes { id name color } }
        }
      }`,
      { projectId, teamId: this.teamId, teamIdFilter: this.teamId }
    );

    const ctx = this.createContext(
      data.team.states.nodes,
      data.team.labels.nodes
    );

    return new Project(
      { id: data.project.id, name: data.project.name, url: data.project.url },
      data.team.states.nodes.map((s) => ({ id: s.id, name: s.name })),
      data.project.issues.nodes.map((i) => new Task(this.toTaskData(i), ctx)),
      data.team.labels.nodes.map((l) => ({ id: l.id, name: l.name })),
      ctx
    );
  }

  async getTask(taskId: string): Promise<Task> {
    const data = await this.request<IssueQueryData>(
      `query($id: String!, $teamId: String!) {
        issue(id: $id) { ${ISSUE_FIELDS} }
        team(id: $teamId) {
          states { nodes { id name } }
          labels { nodes { id name color } }
        }
      }`,
      { id: taskId, teamId: this.teamId }
    );

    const ctx = this.createContext(
      data.team.states.nodes,
      data.team.labels.nodes
    );
    return new Task(this.toTaskData(data.issue), ctx);
  }
}
