import { Throttle } from "@hardlydifficult/throttle";

import { Project } from "../Project.js";
import { buildContextResolvers } from "../resolvers.js";
import { Task } from "../Task.js";
import { TaskListClient } from "../TaskListClient.js";
import type { TaskContext, TaskData, TrelloConfig } from "../types.js";

const TRELLO_API_BASE = "https://api.trello.com/1";

// --- Internal Trello API response shapes (not exported) ---

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

/**
 * Trello implementation of TaskListClient
 */
export class TrelloTaskListClient extends TaskListClient {
  private readonly apiKey: string;
  private readonly token: string;
  private readonly throttle = new Throttle({ unitsPerSecond: 8 });

  constructor(config: TrelloConfig) {
    super(config);
    this.apiKey = config.apiKey ?? process.env.TRELLO_API_KEY ?? "";
    this.token = config.token ?? process.env.TRELLO_API_TOKEN ?? "";
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.throttle.wait();
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
      throw new Error(`Trello API error: ${String(response.status)} ${text}`);
    }

    return response.json() as Promise<T>;
  }

  // --- Mappers: Trello API shapes → platform-agnostic types ---

  private toTaskData(c: TrelloCard): TaskData {
    return {
      id: c.id,
      name: c.name,
      description: c.desc,
      statusId: c.idList,
      projectId: c.idBoard,
      labels: c.labels.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      })),
      url: c.url,
    };
  }

  // --- Context object wired into domain classes ---

  private createContext(
    lists: readonly TrelloList[],
    labels: readonly TrelloLabel[],
    boardId: string
  ): TaskContext {
    return {
      ...buildContextResolvers(lists, labels),

      createTask: async (params): Promise<TaskData> => {
        const body: Record<string, string> = {
          name: params.name,
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
        return this.toTaskData(card);
      },

      updateTask: async (params): Promise<TaskData> => {
        const body: Record<string, string> = {};
        if (params.name !== undefined) {
          body.name = params.name;
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
        return this.toTaskData(card);
      },

      addTaskLabel: async (
        taskId: string,
        labelId: string
      ): Promise<TaskData> => {
        await this.request(`/cards/${taskId}/idLabels`, {
          method: "POST",
          body: JSON.stringify({ value: labelId }),
        });
        // Re-fetch card to get updated state
        const card = await this.request<TrelloCard>(`/cards/${taskId}`);
        return this.toTaskData(card);
      },

      removeTaskLabel: async (
        taskId: string,
        labelId: string
      ): Promise<TaskData> => {
        await this.request(`/cards/${taskId}/idLabels/${labelId}`, {
          method: "DELETE",
        });
        const card = await this.request<TrelloCard>(`/cards/${taskId}`);
        return this.toTaskData(card);
      },

      createLabel: async (
        name: string,
        color?: string
      ): Promise<{ id: string; name: string; color: string }> => {
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
        return { id: label.id, name: label.name, color: label.color };
      },

      deleteLabel: async (labelId: string): Promise<void> => {
        await this.request(`/labels/${labelId}`, {
          method: "DELETE",
        });
      },
    };
  }

  // --- Abstract method implementations ---

  async getProjects(): Promise<Project[]> {
    const trelloBoards =
      await this.request<TrelloBoard[]>("/members/me/boards");

    return Promise.all(
      trelloBoards.map(async (tb) => {
        const [lists, cards, labels] = await Promise.all([
          this.request<TrelloList[]>(`/boards/${tb.id}/lists`),
          this.request<TrelloCard[]>(`/boards/${tb.id}/cards`),
          this.request<TrelloLabel[]>(`/boards/${tb.id}/labels`),
        ]);
        const ctx = this.createContext(lists, labels, tb.id);
        return new Project(
          { id: tb.id, name: tb.name, url: tb.url },
          lists.map((l) => ({ id: l.id, name: l.name })),
          cards.map((c) => new Task(this.toTaskData(c), ctx)),
          labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
          ctx
        );
      })
    );
  }

  async getProject(projectId: string): Promise<Project> {
    const [tb, trelloLists, trelloCards, trelloLabels] = await Promise.all([
      this.request<TrelloBoard>(`/boards/${projectId}`),
      this.request<TrelloList[]>(`/boards/${projectId}/lists`),
      this.request<TrelloCard[]>(`/boards/${projectId}/cards`),
      this.request<TrelloLabel[]>(`/boards/${projectId}/labels`),
    ]);

    const ctx = this.createContext(trelloLists, trelloLabels, tb.id);
    return new Project(
      { id: tb.id, name: tb.name, url: tb.url },
      trelloLists.map((l) => ({ id: l.id, name: l.name })),
      trelloCards.map((c) => new Task(this.toTaskData(c), ctx)),
      trelloLabels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      ctx
    );
  }

  async getTask(taskId: string): Promise<Task> {
    const card = await this.request<TrelloCard>(`/cards/${taskId}`);
    const [lists, labels] = await Promise.all([
      this.request<TrelloList[]>(`/boards/${card.idBoard}/lists`),
      this.request<TrelloLabel[]>(`/boards/${card.idBoard}/labels`),
    ]);
    const ctx = this.createContext(lists, labels, card.idBoard);
    return new Task(this.toTaskData(card), ctx);
  }
}
