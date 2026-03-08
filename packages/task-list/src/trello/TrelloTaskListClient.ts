import {
  TaskListApiError,
  TaskListProviderNotConfiguredError,
} from "../errors.js";
import { Project } from "../Project.js";
import { buildContextResolvers } from "../resolvers.js";
import { Task } from "../Task.js";
import { TaskListClient } from "../TaskListClient.js";
import type {
  Label,
  ProjectSnapshot,
  Status,
  TaskContext,
  TaskData,
  TaskSnapshot,
  TrelloConfig,
} from "../types.js";

const TRELLO_API_BASE = "https://api.trello.com/1";

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

interface TrelloList {
  id: string;
  name: string;
  idBoard: string;
}

interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  idBoard: string;
  idLabels: string[];
  labels: TrelloLabel[];
  url: string;
}

/** Trello-backed task list client implementation. */
export class TrelloTaskListClient extends TaskListClient {
  readonly provider = "trello" as const;

  private readonly apiKey: string;
  private readonly token: string;

  constructor(config: TrelloConfig) {
    super(config);
    this.apiKey = config.apiKey ?? process.env.TRELLO_API_KEY ?? "";
    this.token = config.token ?? process.env.TRELLO_API_TOKEN ?? "";
  }

  initialize(): Promise<void> {
    this.assertConfigured();
    return Promise.resolve();
  }

  async getProjects(): Promise<Project[]> {
    await this.initialize();

    const boards = await this.request<TrelloBoard[]>("/members/me/boards");

    return Promise.all(
      boards.map(
        async (board) => new Project(await this.fetchProjectSnapshot(board.id))
      )
    );
  }

  async getProject(projectId: string): Promise<Project> {
    return new Project(await this.fetchProjectSnapshot(projectId));
  }

  async getTask(taskId: string): Promise<Task> {
    return new Task(await this.fetchTaskSnapshot(taskId));
  }

  private assertConfigured(): void {
    const missing: string[] = [];

    if (this.apiKey === "") {
      missing.push("Set TRELLO_API_KEY or pass { apiKey }");
    }
    if (this.token === "") {
      missing.push("Set TRELLO_API_TOKEN or pass { token }");
    }

    if (missing.length > 0) {
      throw new TaskListProviderNotConfiguredError("trello", missing);
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    this.assertConfigured();

    const url = new URL(`${TRELLO_API_BASE}${path}`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("token", this.token);

    const response = await fetch(url.toString(), {
      method: options.method,
      body: options.body,
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new TaskListApiError("trello", response.status, text);
    }

    return response.json() as Promise<T>;
  }

  private toStatuses(lists: readonly TrelloList[]): readonly Status[] {
    return lists.map((list) => ({ id: list.id, name: list.name }));
  }

  private toLabels(labels: readonly TrelloLabel[]): readonly Label[] {
    return labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    }));
  }

  private toTaskData(card: TrelloCard): TaskData {
    return {
      id: card.id,
      title: card.name,
      description: card.desc,
      statusId: card.idList,
      projectId: card.idBoard,
      labels: card.labels.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
      url: card.url,
    };
  }

  private toProjectSnapshot(
    board: TrelloBoard,
    lists: readonly TrelloList[],
    cards: readonly TrelloCard[],
    labels: readonly TrelloLabel[]
  ): ProjectSnapshot {
    const statuses = this.toStatuses(lists);
    const normalizedLabels = this.toLabels(labels);
    const context = this.createContext(statuses, normalizedLabels, board.id);

    return {
      info: {
        id: board.id,
        name: board.name,
        url: board.url,
      },
      statuses,
      labels: normalizedLabels,
      tasks: cards.map((card) => this.toTaskData(card)),
      context,
    };
  }

  private createContext(
    statuses: readonly Status[],
    labels: readonly Label[],
    boardId: string
  ): TaskContext {
    const context: TaskContext = {
      ...buildContextResolvers(statuses, labels),

      createTask: async (params): Promise<TaskSnapshot> => {
        const body: Record<string, string> = {
          name: params.title,
          idList: params.statusId,
        };

        if (params.description !== undefined) {
          body.desc = params.description;
        }
        if (params.labelIds !== undefined && params.labelIds.length > 0) {
          body.idLabels = params.labelIds.join(",");
        }

        const card = await this.request<TrelloCard>("/cards", {
          method: "POST",
          body: JSON.stringify(body),
        });

        return {
          task: this.toTaskData(card),
          context,
        };
      },

      updateTask: async (params): Promise<TaskSnapshot> => {
        const body: Record<string, string> = {};

        if (params.title !== undefined) {
          body.name = params.title;
        }
        if (params.description !== undefined) {
          body.desc = params.description;
        }
        if (params.statusId !== undefined) {
          body.idList = params.statusId;
        }
        if (params.labelIds !== undefined) {
          body.idLabels = params.labelIds.join(",");
        }

        const card = await this.request<TrelloCard>(`/cards/${params.taskId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });

        return {
          task: this.toTaskData(card),
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
        const body: Record<string, string> = { name };

        if (color !== undefined) {
          body.color = color;
        }

        const label = await this.request<TrelloLabel>(
          `/boards/${boardId}/labels`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        );

        return {
          id: label.id,
          name: label.name,
          color: label.color,
        };
      },

      deleteLabel: async (labelId: string): Promise<void> => {
        await this.request(`/labels/${labelId}`, {
          method: "DELETE",
        });
      },
    };

    return context;
  }

  private async fetchProjectSnapshot(
    projectId: string
  ): Promise<ProjectSnapshot> {
    await this.initialize();

    const [board, lists, cards, labels] = await Promise.all([
      this.request<TrelloBoard>(`/boards/${projectId}`),
      this.request<TrelloList[]>(`/boards/${projectId}/lists`),
      this.request<TrelloCard[]>(`/boards/${projectId}/cards`),
      this.request<TrelloLabel[]>(`/boards/${projectId}/labels`),
    ]);

    return this.toProjectSnapshot(board, lists, cards, labels);
  }

  private async fetchTaskSnapshot(taskId: string): Promise<TaskSnapshot> {
    await this.initialize();

    const card = await this.request<TrelloCard>(`/cards/${taskId}`);
    const [lists, labels] = await Promise.all([
      this.request<TrelloList[]>(`/boards/${card.idBoard}/lists`),
      this.request<TrelloLabel[]>(`/boards/${card.idBoard}/labels`),
    ]);
    const statuses = this.toStatuses(lists);
    const normalizedLabels = this.toLabels(labels);
    const context = this.createContext(
      statuses,
      normalizedLabels,
      card.idBoard
    );

    return {
      task: this.toTaskData(card),
      context,
    };
  }
}
