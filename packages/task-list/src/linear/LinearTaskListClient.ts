import {
  InvalidPriorityError,
  LinearGraphQLError,
  MultipleTeamsFoundError,
  NoTeamsFoundError,
  TaskListApiError,
  TaskListProviderNotConfiguredError,
  TeamNotFoundError,
} from "../errors.js";
import { Project } from "../Project.js";
import { buildContextResolvers, matchesCaseInsensitive } from "../resolvers.js";
import { Task } from "../Task.js";
import { TaskListClient } from "../TaskListClient.js";
import type {
  Label,
  LinearConfig,
  ProjectSnapshot,
  Status,
  TaskContext,
  TaskData,
  TaskSnapshot,
} from "../types.js";

import {
  type GraphQLResponse,
  ISSUE_CREATE_MUTATION,
  ISSUE_FETCH_QUERY,
  ISSUE_FIELDS,
  ISSUE_UPDATE_MUTATION,
  type IssueCreateData,
  type IssueQueryData,
  type IssueUpdateData,
  LABEL_CREATE_MUTATION,
  LABEL_DELETE_MUTATION,
  type LabelCreateData,
  type LinearIssue,
  type LinearIssueLabel,
  type LinearProject,
  type LinearWorkflowState,
  PRIORITY_NAME_TO_NUMBER,
  type ProjectQueryData,
  type ProjectsQueryData,
  type TeamsQueryData,
} from "./queries.js";

const LINEAR_API_URL = "https://api.linear.app/graphql";

export class LinearTaskListClient extends TaskListClient {
  readonly provider = "linear" as const;

  private readonly apiKey: string;
  private teamId: string | undefined;
  private readonly teamName: string | undefined;
  private teamResolutionPromise: Promise<void> | null = null;

  private static proxyConfigured = false;

  private static configureProxy(): void {
    if (LinearTaskListClient.proxyConfigured) {
      return;
    }

    LinearTaskListClient.proxyConfigured = true;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const undici = require("undici") as {
        ProxyAgent: new (url: string) => unknown;
        setGlobalDispatcher: (dispatcher: unknown) => void;
      };
      const proxy = process.env.https_proxy ?? process.env.HTTPS_PROXY;

      if (proxy !== undefined) {
        undici.setGlobalDispatcher(new undici.ProxyAgent(proxy));
      }
    } catch {
      // undici not available
    }
  }

  constructor(config: LinearConfig) {
    super({ provider: "linear", ...config });
    LinearTaskListClient.configureProxy();
    this.apiKey = config.apiKey ?? process.env.LINEAR_API_KEY ?? "";
    this.teamId = config.teamId;
    this.teamName = config.team;
  }

  async initialize(): Promise<void> {
    this.assertConfigured();
    await this.resolveTeam();
  }

  async resolveTeam(): Promise<void> {
    await this.ensureTeamResolved();
  }

  async getProjects(): Promise<Project[]> {
    await this.initialize();

    const teamId = this.teamId as string;
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
      { teamId, teamIdFilter: teamId }
    );

    const statuses = this.toStatuses(data.team.states.nodes);
    const labels = this.toLabels(data.team.labels.nodes);
    const context = this.createContext(statuses, labels);

    return data.team.projects.nodes.map((project) => {
      return new Project(
        this.toProjectSnapshot(project, project.issues.nodes, context, statuses, labels)
      );
    });
  }

  async getProject(projectId: string): Promise<Project> {
    return new Project(await this.fetchProjectSnapshot(projectId));
  }

  async getTask(taskId: string): Promise<Task> {
    return new Task(await this.fetchTaskSnapshot(taskId));
  }

  private assertConfigured(): void {
    if (this.apiKey !== "") {
      return;
    }

    throw new TaskListProviderNotConfiguredError("linear", [
      "Set LINEAR_API_KEY",
      "Pass { apiKey }",
    ]);
  }

  private async ensureTeamResolved(): Promise<void> {
    if (this.teamId !== undefined) {
      return;
    }

    if (this.teamResolutionPromise !== null) {
      await this.teamResolutionPromise;
      return;
    }

    this.teamResolutionPromise = (async () => {
      const data = await this.request<TeamsQueryData>(
        `query { teams { nodes { id name } } }`
      );
      const teams = data.teams.nodes;

      if (this.teamName !== undefined) {
        const team = teams.find((entry) =>
          matchesCaseInsensitive(entry.name, this.teamName as string)
        );

        if (!team) {
          throw new TeamNotFoundError(
            this.teamName,
            teams.map((entry) => entry.name)
          );
        }

        this.teamId = team.id;
        return;
      }

      if (teams.length === 1) {
        this.teamId = teams[0]?.id;
        return;
      }

      if (teams.length === 0) {
        throw new NoTeamsFoundError();
      }

      throw new MultipleTeamsFoundError(teams.map((entry) => entry.name));
    })();

    try {
      await this.teamResolutionPromise;
    } finally {
      this.teamResolutionPromise = null;
    }
  }

  private async request<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    this.assertConfigured();

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
      throw new TaskListApiError("linear", response.status, text);
    }

    const json = (await response.json()) as GraphQLResponse<T>;
    if (json.errors && json.errors.length > 0) {
      throw new LinearGraphQLError(json.errors[0]!.message);
    }

    return json.data;
  }

  private toStatuses(states: readonly LinearWorkflowState[]): readonly Status[] {
    return states.map((state) => ({ id: state.id, name: state.name }));
  }

  private toLabels(labels: readonly LinearIssueLabel[]): readonly Label[] {
    return labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    }));
  }

  private toTaskData(issue: LinearIssue): TaskData {
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description ?? "",
      statusId: issue.state.id,
      projectId: issue.project?.id ?? "",
      labels: issue.labels.nodes.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
      url: issue.url,
      priority: issue.priority,
    };
  }

  private toProjectSnapshot(
    project: LinearProject,
    issues: readonly LinearIssue[],
    context: TaskContext,
    statuses: readonly Status[],
    labels: readonly Label[]
  ): ProjectSnapshot {
    return {
      info: {
        id: project.id,
        name: project.name,
        url: project.url,
      },
      statuses,
      labels,
      tasks: issues.map((issue) => this.toTaskData(issue)),
      context,
    };
  }

  private createContext(
    statuses: readonly Status[],
    labels: readonly Label[]
  ): TaskContext {
    const context: TaskContext = {
      ...buildContextResolvers(statuses, labels),

      createTask: async (params): Promise<TaskSnapshot> => {
        await this.initialize();

        const input: Record<string, unknown> = {
          teamId: this.teamId,
          projectId: params.projectId,
          stateId: params.statusId,
          title: params.title,
        };

        if (params.description !== undefined) {
          input.description = params.description;
        }
        if (params.labelIds !== undefined && params.labelIds.length > 0) {
          input.labelIds = params.labelIds;
        }
        if (params.priority !== undefined) {
          input.priority = params.priority;
        }

        const result = await this.request<IssueCreateData>(
          ISSUE_CREATE_MUTATION,
          { input }
        );

        return {
          task: this.toTaskData(result.issueCreate.issue),
          context,
        };
      },

      updateTask: async (params): Promise<TaskSnapshot> => {
        const input: Record<string, unknown> = {};

        if (params.title !== undefined) {
          input.title = params.title;
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
        if (params.priority !== undefined) {
          input.priority = params.priority;
        }

        const result = await this.request<IssueUpdateData>(
          ISSUE_UPDATE_MUTATION,
          { id: params.taskId, input }
        );

        return {
          task: this.toTaskData(result.issueUpdate.issue),
          context,
        };
      },

      fetchTask: async (taskId: string): Promise<TaskSnapshot> => {
        return this.fetchTaskSnapshot(taskId);
      },

      fetchProject: async (projectId: string): Promise<ProjectSnapshot> => {
        return this.fetchProjectSnapshot(projectId);
      },

      createLabel: async (name: string, color?: string): Promise<Label> => {
        await this.initialize();

        const input: Record<string, unknown> = {
          teamId: this.teamId,
          name,
        };

        if (color !== undefined) {
          input.color = color;
        }

        const result = await this.request<LabelCreateData>(
          LABEL_CREATE_MUTATION,
          { input }
        );
        const label = result.issueLabelCreate.issueLabel;

        return {
          id: label.id,
          name: label.name,
          color: label.color,
        };
      },

      deleteLabel: async (labelId: string): Promise<void> => {
        await this.request(LABEL_DELETE_MUTATION, { id: labelId });
      },

      resolvePriority: (name: string): number => {
        const value = PRIORITY_NAME_TO_NUMBER[name.toLowerCase()];

        if (value === undefined) {
          throw new InvalidPriorityError(name);
        }

        return value;
      },
    };

    return context;
  }

  private async fetchProjectSnapshot(projectId: string): Promise<ProjectSnapshot> {
    await this.initialize();

    const teamId = this.teamId as string;
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
      { projectId, teamId, teamIdFilter: teamId }
    );

    const statuses = this.toStatuses(data.team.states.nodes);
    const labels = this.toLabels(data.team.labels.nodes);
    const context = this.createContext(statuses, labels);

    return this.toProjectSnapshot(
      data.project,
      data.project.issues.nodes,
      context,
      statuses,
      labels
    );
  }

  private async fetchTaskSnapshot(taskId: string): Promise<TaskSnapshot> {
    await this.initialize();

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

    const statuses = this.toStatuses(data.team.states.nodes);
    const labels = this.toLabels(data.team.labels.nodes);
    const context = this.createContext(statuses, labels);

    return {
      task: this.toTaskData(data.issue),
      context,
    };
  }
}
