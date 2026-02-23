export class TaskListError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class UnknownTaskListProviderError extends TaskListError {
  constructor(provider: string) {
    super(`Unknown task list provider: ${provider}`, "UNKNOWN_PROVIDER", {
      provider,
    });
  }
}

export class TaskListProviderNotConfiguredError extends TaskListError {
  constructor() {
    super(
      "No task list provider configured. Set LINEAR_API_KEY or TRELLO_API_KEY.",
      "PROVIDER_NOT_CONFIGURED"
    );
  }
}

export class ProjectNotFoundError extends TaskListError {
  constructor(name: string) {
    super(`Project "${name}" not found`, "PROJECT_NOT_FOUND", { name });
  }
}

export class TaskNotFoundError extends TaskListError {
  constructor(taskId: string, projectName: string) {
    super(
      `Task "${taskId}" not found in project "${projectName}"`,
      "TASK_NOT_FOUND",
      { taskId, projectName }
    );
  }
}

export class StatusNotFoundError extends TaskListError {
  constructor(name: string, projectName?: string) {
    super(
      projectName
        ? `Status "${name}" not found in project "${projectName}"`
        : `Status "${name}" not found`,
      "STATUS_NOT_FOUND",
      { name, projectName }
    );
  }
}

export class StatusIdNotFoundError extends TaskListError {
  constructor(id: string) {
    super(`Status with ID "${id}" not found`, "STATUS_ID_NOT_FOUND", { id });
  }
}

export class LabelNotFoundError extends TaskListError {
  constructor(name: string, projectName?: string) {
    super(
      projectName
        ? `Label "${name}" not found in project "${projectName}"`
        : `Label "${name}" not found`,
      "LABEL_NOT_FOUND",
      { name, projectName }
    );
  }
}

export class TeamNotFoundError extends TaskListError {
  constructor(teamName: string, availableTeams: readonly string[]) {
    super(
      `Team "${teamName}" not found. Available teams: ${availableTeams.join(", ")}`,
      "TEAM_NOT_FOUND",
      { teamName, availableTeams }
    );
  }
}

export class NoTeamsFoundError extends TaskListError {
  constructor() {
    super("No teams found in Linear workspace", "NO_TEAMS_FOUND");
  }
}

export class MultipleTeamsFoundError extends TaskListError {
  constructor(availableTeams: readonly string[]) {
    super(
      `Multiple teams found. Specify team name or ID. Available teams: ${availableTeams.join(", ")}`,
      "MULTIPLE_TEAMS_FOUND",
      { availableTeams }
    );
  }
}

export class TeamNotResolvedError extends TaskListError {
  constructor() {
    super("Team not resolved. Call resolveTeam() first.", "TEAM_NOT_RESOLVED");
  }
}

export class TaskListApiError extends TaskListError {
  constructor(
    provider: "linear" | "trello",
    status: number,
    responseBody: string
  ) {
    super(
      `${provider === "linear" ? "Linear" : "Trello"} API error: ${String(status)} ${responseBody}`,
      "API_ERROR",
      { provider, status, responseBody }
    );
  }
}

export class LinearGraphQLError extends TaskListError {
  constructor(message: string) {
    super(`Linear API error: ${message}`, "LINEAR_GRAPHQL_ERROR", {
      provider: "linear",
      graphqlMessage: message,
    });
  }
}

export class InvalidPriorityError extends TaskListError {
  constructor(name: string) {
    super(
      `Priority "${name}" not recognized. Use: None, Urgent, High, Medium, Low`,
      "INVALID_PRIORITY",
      { name, allowed: ["None", "Urgent", "High", "Medium", "Low"] }
    );
  }
}
