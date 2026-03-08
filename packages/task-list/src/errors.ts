function formatAvailable(items: readonly string[] | undefined): string {
  if (!items || items.length === 0) {
    return "";
  }
  return ` Available: ${items.join(", ")}`;
}

/**
 *
 */
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

/**
 *
 */
export class UnknownTaskListProviderError extends TaskListError {
  constructor(provider: string) {
    super(`Unknown task list provider: ${provider}`, "UNKNOWN_PROVIDER", {
      provider,
    });
  }
}

/**
 *
 */
export class TaskListProviderNotConfiguredError extends TaskListError {
  constructor(provider: "linear" | "trello", missing: readonly string[] = []) {
    super(
      provider === "linear"
        ? `Linear provider is not configured.${formatAvailable(missing)}`
        : `Trello provider is not configured.${formatAvailable(missing)}`,
      "PROVIDER_NOT_CONFIGURED",
      { provider, missing }
    );
  }
}

/**
 *
 */
export class ProjectNotFoundError extends TaskListError {
  constructor(name: string, availableProjects: readonly string[] = []) {
    super(
      `Project "${name}" not found.${formatAvailable(availableProjects)}`,
      "PROJECT_NOT_FOUND",
      { name, availableProjects }
    );
  }
}

/**
 *
 */
export class TaskNotFoundError extends TaskListError {
  constructor(
    taskId: string,
    projectName: string,
    availableTaskIds: readonly string[] = []
  ) {
    super(
      `Task "${taskId}" not found in project "${projectName}".${formatAvailable(availableTaskIds)}`,
      "TASK_NOT_FOUND",
      { taskId, projectName, availableTaskIds }
    );
  }
}

/**
 *
 */
export class StatusNotFoundError extends TaskListError {
  constructor(
    name: string,
    projectName?: string,
    availableStatuses: readonly string[] = []
  ) {
    super(
      projectName !== undefined
        ? `Status "${name}" not found in project "${projectName}".${formatAvailable(availableStatuses)}`
        : `Status "${name}" not found.${formatAvailable(availableStatuses)}`,
      "STATUS_NOT_FOUND",
      { name, projectName, availableStatuses }
    );
  }
}

/**
 *
 */
export class StatusIdNotFoundError extends TaskListError {
  constructor(id: string, availableStatuses: readonly string[] = []) {
    super(
      `Status with ID "${id}" not found.${formatAvailable(availableStatuses)}`,
      "STATUS_ID_NOT_FOUND",
      { id, availableStatuses }
    );
  }
}

/**
 *
 */
export class LabelNotFoundError extends TaskListError {
  constructor(
    name: string,
    projectName?: string,
    availableLabels: readonly string[] = []
  ) {
    super(
      projectName !== undefined
        ? `Label "${name}" not found in project "${projectName}".${formatAvailable(availableLabels)}`
        : `Label "${name}" not found.${formatAvailable(availableLabels)}`,
      "LABEL_NOT_FOUND",
      { name, projectName, availableLabels }
    );
  }
}

/**
 *
 */
export class TeamNotFoundError extends TaskListError {
  constructor(teamName: string, availableTeams: readonly string[]) {
    super(
      `Team "${teamName}" not found.${formatAvailable(availableTeams)}`,
      "TEAM_NOT_FOUND",
      { teamName, availableTeams }
    );
  }
}

/**
 *
 */
export class NoTeamsFoundError extends TaskListError {
  constructor() {
    super("No teams found in Linear workspace", "NO_TEAMS_FOUND");
  }
}

/**
 *
 */
export class MultipleTeamsFoundError extends TaskListError {
  constructor(availableTeams: readonly string[]) {
    super(
      `Multiple teams found. Specify a team or teamId.${formatAvailable(availableTeams)}`,
      "MULTIPLE_TEAMS_FOUND",
      { availableTeams }
    );
  }
}

/**
 *
 */
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

/**
 *
 */
export class LinearGraphQLError extends TaskListError {
  constructor(message: string) {
    super(`Linear API error: ${message}`, "LINEAR_GRAPHQL_ERROR", {
      provider: "linear",
      graphqlMessage: message,
    });
  }
}

/**
 *
 */
export class InvalidPriorityError extends TaskListError {
  constructor(name: string) {
    super(
      `Priority "${name}" not recognized. Use: None, Urgent, High, Medium, Low`,
      "INVALID_PRIORITY",
      { name, allowed: ["None", "Urgent", "High", "Medium", "Low"] }
    );
  }
}
