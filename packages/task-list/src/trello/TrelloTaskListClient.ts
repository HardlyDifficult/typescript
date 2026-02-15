import { BoardState } from "../BoardState.js";
import { FullState } from "../FullState.js";
import { Task } from "../Task.js";
import { TaskList } from "../TaskList.js";
import { TaskListClient } from "../TaskListClient.js";
import type {
  Board,
  Label,
  TaskData,
  TaskOperations,
  TrelloConfig,
} from "../types.js";

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

  constructor(config: TrelloConfig) {
    super(config);
    this.apiKey = config.apiKey ?? process.env.TRELLO_API_KEY ?? "";
    this.token = config.token ?? process.env.TRELLO_API_TOKEN ?? "";
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
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

  private toBoard(b: TrelloBoard): Board {
    return { id: b.id, name: b.name, url: b.url };
  }

  private toLabel(l: TrelloLabel): Label {
    return { id: l.id, name: l.name, color: l.color };
  }

  private toTaskData(c: TrelloCard): TaskData {
    return {
      id: c.id,
      name: c.name,
      description: c.desc,
      listId: c.idList,
      boardId: c.idBoard,
      labels: c.labels.map((l) => this.toLabel(l)),
      url: c.url,
    };
  }

  // --- Operations object wired into domain classes ---

  private createOperations(): TaskOperations {
    return {
      createTask: async (
        listId: string,
        name: string,
        description?: string,
        labelIds?: readonly string[]
      ): Promise<TaskData> => {
        const body: Record<string, string> = { name, idList: listId };
        if (description !== undefined) {
          body.desc = description;
        }
        if (labelIds !== undefined && labelIds.length > 0) {
          body.idLabels = labelIds.join(",");
        }
        const card = await this.request<TrelloCard>("/cards", {
          method: "POST",
          body: JSON.stringify(body),
        });
        return this.toTaskData(card);
      },

      updateTask: async (
        taskId: string,
        name?: string,
        description?: string,
        listId?: string,
        labelIds?: readonly string[]
      ): Promise<TaskData> => {
        const body: Record<string, string> = {};
        if (name !== undefined) {
          body.name = name;
        }
        if (description !== undefined) {
          body.desc = description;
        }
        if (listId !== undefined) {
          body.idList = listId;
        }
        if (labelIds !== undefined) {
          body.idLabels = labelIds.join(",");
        }
        const card = await this.request<TrelloCard>(`/cards/${taskId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        return this.toTaskData(card);
      },
    };
  }

  // --- Abstract method implementations ---

  async getBoards(): Promise<FullState> {
    const ops = this.createOperations();
    const trelloBoards =
      await this.request<TrelloBoard[]>("/members/me/boards");

    const boardStates = await Promise.all(
      trelloBoards.map(async (tb) => {
        const [lists, cards, labels] = await Promise.all([
          this.request<TrelloList[]>(`/boards/${tb.id}/lists`),
          this.request<TrelloCard[]>(`/boards/${tb.id}/cards`),
          this.request<TrelloLabel[]>(`/boards/${tb.id}/labels`),
        ]);
        return new BoardState(
          this.toBoard(tb),
          lists.map(
            (l) =>
              new TaskList({ id: l.id, name: l.name, boardId: l.idBoard }, ops)
          ),
          cards.map((c) => new Task(this.toTaskData(c), ops)),
          labels.map((l) => this.toLabel(l))
        );
      })
    );

    return new FullState(boardStates);
  }

  async getBoard(boardId: string): Promise<BoardState> {
    const ops = this.createOperations();
    const [tb, trelloLists, trelloCards, trelloLabels] = await Promise.all([
      this.request<TrelloBoard>(`/boards/${boardId}`),
      this.request<TrelloList[]>(`/boards/${boardId}/lists`),
      this.request<TrelloCard[]>(`/boards/${boardId}/cards`),
      this.request<TrelloLabel[]>(`/boards/${boardId}/labels`),
    ]);

    return new BoardState(
      this.toBoard(tb),
      trelloLists.map(
        (l) => new TaskList({ id: l.id, name: l.name, boardId: l.idBoard }, ops)
      ),
      trelloCards.map((c) => new Task(this.toTaskData(c), ops)),
      trelloLabels.map((l) => this.toLabel(l))
    );
  }

  async getTask(taskId: string): Promise<Task> {
    const ops = this.createOperations();
    const card = await this.request<TrelloCard>(`/cards/${taskId}`);
    return new Task(this.toTaskData(card), ops);
  }
}
