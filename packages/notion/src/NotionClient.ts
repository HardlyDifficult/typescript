import type {
  AppendBlocksRequest,
  CreatePageRequest,
  NotionBlock,
  NotionPageResponse,
  NotionPropertyValue,
} from "./types.js";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** Maximum characters per Notion rich text block. */
const MAX_BLOCK_TEXT_LENGTH = 2000;

/** Maximum blocks per API request (Notion limit). */
const MAX_BLOCKS_PER_REQUEST = 100;

export interface NotionClientOptions {
  apiToken: string;
  fetchImpl?: typeof fetch;
}

/** Splits long text into chunks fitting within Notion's block size limit. */
function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }
  return chunks;
}

/** Converts a text string into one or more paragraph blocks. */
function textToParagraphBlocks(text: string): NotionBlock[] {
  return splitIntoChunks(text, MAX_BLOCK_TEXT_LENGTH).map((chunk) => ({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [{ type: "text" as const, text: { content: chunk } }],
    },
  }));
}

/** Client for interacting with the Notion REST API. */
export class NotionClient {
  private readonly apiToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NotionClientOptions) {
    if (options.apiToken.trim() === "") {
      throw new Error("Notion API token is required");
    }
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    };
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${NOTION_API_BASE}${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Notion API error ${String(response.status)}: ${text}`);
    }

    return JSON.parse(text) as T;
  }

  /**
   * Creates a page in a Notion database.
   *
   * Properties should match the database schema. The title property
   * key must match the title column name in the database (usually "Name").
   *
   * Returns the created page's ID and URL.
   */
  async createPage(
    databaseId: string,
    properties: Record<string, NotionPropertyValue>,
    bodyBlocks?: NotionBlock[]
  ): Promise<NotionPageResponse> {
    const firstBatch = bodyBlocks?.slice(0, MAX_BLOCKS_PER_REQUEST);

    const payload: CreatePageRequest = {
      parent: { database_id: databaseId },
      properties,
      ...(firstBatch && firstBatch.length > 0 ? { children: firstBatch } : {}),
    };

    const page = await this.request<NotionPageResponse>(
      "POST",
      "/pages",
      payload
    );

    // Append remaining blocks if the transcript exceeded the per-request limit
    const remaining = bodyBlocks?.slice(MAX_BLOCKS_PER_REQUEST) ?? [];
    if (remaining.length > 0) {
      await this.appendBlocks(page.id, remaining);
    }

    return page;
  }

  /** Appends blocks to an existing page, batching to respect the 100-block limit. */
  async appendBlocks(pageId: string, blocks: NotionBlock[]): Promise<void> {
    for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
      const batch = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);
      const payload: AppendBlocksRequest = { children: batch };
      await this.request<unknown>(
        "PATCH",
        `/blocks/${pageId}/children`,
        payload
      );
    }
  }

  /**
   * Builds the page body blocks for a call transcript.
   * Adds a "Transcript" heading followed by the transcript text split into chunks.
   */
  static buildTranscriptBlocks(transcript: string): NotionBlock[] {
    return [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Transcript" } }],
        },
      },
      ...textToParagraphBlocks(transcript),
    ];
  }
}
