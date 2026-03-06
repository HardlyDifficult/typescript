import {
  blocksToMarkdown,
  markdownToBlocks,
  richTextToPlainText,
  selectionFromMarkdown,
} from "./markdown.js";
import type {
  AppendBlocksRequest,
  CreatePageRequest,
  NotionApiVersion,
  NotionBlock,
  NotionPageContent,
  NotionPageMarkdownResponse,
  NotionPageMeta,
  NotionPagePropertyMap,
  NotionPageResponse,
  NotionPageSearchResult,
  NotionParent,
  NotionPropertyValue,
  ReadPageOptions,
  RetrieveBlockChildrenOptions,
  SearchPagesOptions,
  UpdatePageMarkdownRequest,
  UpdatePageOptions,
} from "./types.js";

const NOTION_API_BASE = "https://api.notion.com/v1";
const LEGACY_NOTION_VERSION = "2022-06-28";
const MARKDOWN_NOTION_VERSION = "2025-09-03";

/** Maximum characters per Notion rich text block. */
const MAX_BLOCK_TEXT_LENGTH = 2000;

/** Maximum blocks per API request (Notion limit). */
const MAX_BLOCKS_PER_REQUEST = 100;

interface RequestOptions {
  notionVersion?: NotionApiVersion;
  query?: Record<string, boolean | number | string | undefined>;
}

interface NotionSearchResponse {
  object: "list";
  results: NotionPageResponse[];
  next_cursor: string | null;
  has_more: boolean;
}

interface RawMarkdownPageResponse extends NotionPageResponse {
  markdown?: string;
  content?: string;
  truncated?: boolean;
  unknown_block_ids?: string[];
}

export interface NotionClientOptions {
  apiToken: string;
  fetchImpl?: typeof fetch;
  apiVersion?: NotionApiVersion;
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

function buildLegacyParent(databaseId: string): { database_id: string } {
  return { database_id: databaseId };
}

function normalizeParent(parent: NotionParent | string): {
  parent: CreatePageRequest["parent"];
  notionVersion: NotionApiVersion;
} {
  if (typeof parent === "string") {
    return {
      parent: buildLegacyParent(parent),
      notionVersion: LEGACY_NOTION_VERSION,
    };
  }

  if (parent.type === "data_source_id") {
    return {
      parent,
      notionVersion: MARKDOWN_NOTION_VERSION,
    };
  }

  if (parent.type === "database_id") {
    return {
      parent: buildLegacyParent(parent.database_id),
      notionVersion: LEGACY_NOTION_VERSION,
    };
  }

  if (parent.type === "page_id") {
    return {
      parent: { page_id: parent.page_id },
      notionVersion: LEGACY_NOTION_VERSION,
    };
  }

  return {
    parent: { workspace: true },
    notionVersion: LEGACY_NOTION_VERSION,
  };
}

function extractPageTitle(properties?: NotionPagePropertyMap): string {
  if (properties === undefined) {
    return "";
  }

  for (const property of Object.values(properties)) {
    if (property.type === "title" && Array.isArray(property.title)) {
      return richTextToPlainText(property.title);
    }
  }

  return "";
}

function toPageMeta(page: NotionPageResponse): NotionPageMeta {
  return {
    id: page.id,
    title: extractPageTitle(page.properties),
    url: page.url,
    lastEdited: page.last_edited_time ?? null,
    createdTime: page.created_time ?? null,
    archived: page.archived ?? false,
    inTrash: page.in_trash ?? false,
    parent: page.parent,
    properties: page.properties ?? {},
    icon: page.icon ?? null,
    cover: page.cover ?? null,
  };
}

/** Client for interacting with the Notion REST API. */
export class NotionClient {
  private readonly apiToken: string;
  private readonly fetchImpl: typeof fetch;
  private readonly apiVersion: NotionApiVersion;

  constructor(options: NotionClientOptions) {
    if (options.apiToken.trim() === "") {
      throw new Error("Notion API token is required");
    }
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiVersion = options.apiVersion ?? LEGACY_NOTION_VERSION;
  }

  private getHeaders(notionVersion: NotionApiVersion): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      "Notion-Version": notionVersion,
    };
  }

  private async request<T>(
    method: "GET" | "PATCH" | "POST",
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = new URL(`${NOTION_API_BASE}${path}`);
    for (const [key, value] of Object.entries(options?.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await this.fetchImpl(url.toString(), {
      method,
      headers: this.getHeaders(options?.notionVersion ?? this.apiVersion),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Notion API error ${String(response.status)}: ${text}`);
    }

    if (text.trim().length === 0) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  /**
   * Creates a page in a Notion database, data source, page, or workspace.
   *
   * Existing callers can continue to pass a database ID string as the first
   * argument. When `content` is a markdown string and a modern parent type is
   * used, the markdown endpoint is used directly. Legacy database parents use
   * block conversion for backwards compatibility.
   */
  async createPage(
    parentOrDatabaseId: NotionParent | string,
    properties: Record<string, NotionPropertyValue> = {},
    content?: NotionBlock[] | string
  ): Promise<NotionPageResponse> {
    const normalized = normalizeParent(parentOrDatabaseId);
    const parent = normalized.parent;

    if (
      typeof content === "string" &&
      typeof parentOrDatabaseId !== "string" &&
      parentOrDatabaseId.type !== "database_id"
    ) {
      return this.request<NotionPageResponse>(
        "POST",
        "/pages",
        {
          parent,
          properties,
          markdown: content,
        } satisfies CreatePageRequest,
        { notionVersion: MARKDOWN_NOTION_VERSION }
      );
    }

    const bodyBlocks =
      typeof content === "string" ? this.markdownToBlocks(content) : content;
    const firstBatch = bodyBlocks?.slice(0, MAX_BLOCKS_PER_REQUEST);

    const payload: CreatePageRequest = {
      parent,
      properties,
      ...(firstBatch !== undefined && firstBatch.length > 0
        ? { children: firstBatch }
        : {}),
    };

    const page = await this.request<NotionPageResponse>("POST", "/pages", payload, {
      notionVersion: normalized.notionVersion,
    });

    const remaining = bodyBlocks?.slice(MAX_BLOCKS_PER_REQUEST) ?? [];
    if (remaining.length > 0) {
      await this.appendBlocks(page.id, remaining);
    }

    return page;
  }

  async createPageMarkdown(
    parent: Exclude<NotionParent, { type: "database_id" }>,
    markdown: string,
    properties: Record<string, NotionPropertyValue> = {}
  ): Promise<NotionPageResponse> {
    const normalized = normalizeParent(parent);
    return this.request<NotionPageResponse>(
      "POST",
      "/pages",
      {
        parent: normalized.parent,
        properties,
        markdown,
      } satisfies CreatePageRequest,
      { notionVersion: MARKDOWN_NOTION_VERSION }
    );
  }

  /** Appends blocks to an existing page, batching to respect the 100-block limit. */
  async appendBlocks(pageId: string, blocks: NotionBlock[]): Promise<void> {
    for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
      const batch = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);
      const payload: AppendBlocksRequest = { children: batch };
      await this.request<unknown>("PATCH", `/blocks/${pageId}/children`, payload);
    }
  }

  async retrieveBlockChildren(
    blockId: string,
    options?: RetrieveBlockChildrenOptions
  ): Promise<NotionBlock[]> {
    const results: NotionBlock[] = [];
    let cursor = options?.startCursor;
    const pageSize = options?.pageSize;

    do {
      const response = await this.request<{
        object: "list";
        results: NotionBlock[];
        next_cursor: string | null;
        has_more: boolean;
      }>("GET", `/blocks/${blockId}/children`, undefined, {
        query: {
          page_size: pageSize,
          start_cursor: cursor,
        },
      });

      for (const block of response.results) {
        const nextBlock = block;
        if (options?.recursive === true && block.has_children === true && block.id !== undefined) {
          const children = await this.retrieveBlockChildren(block.id, {
            ...options,
            startCursor: undefined,
          });
          switch (nextBlock.type) {
            case "paragraph":
              nextBlock.paragraph = { ...nextBlock.paragraph, children };
              break;
            case "bulleted_list_item":
              nextBlock.bulleted_list_item = {
                ...nextBlock.bulleted_list_item,
                children,
              };
              break;
            case "numbered_list_item":
              nextBlock.numbered_list_item = {
                ...nextBlock.numbered_list_item,
                children,
              };
              break;
            case "to_do":
              nextBlock.to_do = { ...nextBlock.to_do, children };
              break;
            case "toggle":
              nextBlock.toggle = { ...nextBlock.toggle, children };
              break;
            case "quote":
              nextBlock.quote = { ...nextBlock.quote, children };
              break;
            case "callout":
              nextBlock.callout = { ...nextBlock.callout, children };
              break;
            case "synced_block":
              nextBlock.synced_block = { ...nextBlock.synced_block, children };
              break;
            default:
              break;
          }
        }
        results.push(nextBlock);
      }

      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor !== undefined);

    return results;
  }

  async getPageBlocks(
    pageId: string,
    options?: RetrieveBlockChildrenOptions
  ): Promise<NotionBlock[]> {
    return this.retrieveBlockChildren(pageId, options);
  }

  async getPageMeta(pageId: string): Promise<NotionPageMeta> {
    const page = await this.request<NotionPageResponse>("GET", `/pages/${pageId}`, undefined, {
      notionVersion: MARKDOWN_NOTION_VERSION,
    });
    return toPageMeta(page);
  }

  async readPage(pageId: string, options?: ReadPageOptions): Promise<NotionPageContent> {
    try {
      const page = await this.request<RawMarkdownPageResponse>(
        "GET",
        `/pages/${pageId}`,
        undefined,
        {
          notionVersion: MARKDOWN_NOTION_VERSION,
          query: {
            content_format: "markdown",
            include_transcript: options?.includeTranscript,
          },
        }
      );
      const meta = toPageMeta(page);
      return {
        ...meta,
        markdown: page.markdown ?? page.content ?? "",
        truncated: page.truncated ?? false,
        unknownBlockIds: page.unknown_block_ids ?? [],
      };
    } catch (error) {
      if (options?.fallbackToBlocks !== true) {
        throw error;
      }

      const [meta, blocks] = await Promise.all([
        this.getPageMeta(pageId),
        this.getPageBlocks(pageId, { recursive: true }),
      ]);

      return {
        ...meta,
        markdown: this.blocksToMarkdown(blocks),
        truncated: false,
        unknownBlockIds: [],
      };
    }
  }

  async searchPages(
    query: string,
    options?: SearchPagesOptions
  ): Promise<NotionPageSearchResult[]> {
    const results: NotionPageSearchResult[] = [];
    let cursor = options?.startCursor;
    const pageSize = options?.pageSize;
    const limit = options?.limit;

    do {
      const response = await this.request<NotionSearchResponse>(
        "POST",
        "/search",
        {
          query,
          filter: options?.filter ?? { property: "object", value: "page" },
          sort: options?.sort,
          start_cursor: cursor,
          page_size: pageSize,
        },
        {
          notionVersion: MARKDOWN_NOTION_VERSION,
        }
      );

      for (const page of response.results) {
        if (page.object !== undefined && page.object !== "page") {
          continue;
        }
        results.push({
          ...toPageMeta(page),
          object: page.object,
        });
        if (limit !== undefined && results.length >= limit) {
          return results.slice(0, limit);
        }
      }

      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor !== undefined);

    return results;
  }

  async updatePage(
    pageId: string,
    content: string,
    options?: UpdatePageOptions
  ): Promise<NotionPageMarkdownResponse> {
    if (options?.replace === true) {
      const contentRange =
        options.contentRange ?? selectionFromMarkdown((await this.readPage(pageId)).markdown);
      if (contentRange === undefined) {
        return this.updatePageMarkdown(pageId, {
          type: "insert_content",
          insert_content: { content, after: options.after },
        });
      }
      return this.updatePageMarkdown(pageId, {
        type: "replace_content_range",
        replace_content_range: {
          content,
          content_range: contentRange,
          allow_deleting_content: options.allowDeletingContent,
        },
      });
    }

    return this.updatePageMarkdown(pageId, {
      type: "insert_content",
      insert_content: {
        content,
        after: options?.after,
      },
    });
  }

  async updatePageMarkdown(
    pageId: string,
    request: UpdatePageMarkdownRequest
  ): Promise<NotionPageMarkdownResponse> {
    const response = await this.request<NotionPageMarkdownResponse | RawMarkdownPageResponse>(
      "PATCH",
      `/pages/${pageId}/markdown`,
      request,
      { notionVersion: MARKDOWN_NOTION_VERSION }
    );

    if ("object" in response && response.object === "page_markdown") {
      return response;
    }

    return {
      object: "page_markdown",
      id: response.id,
      markdown: response.markdown ?? response.content ?? "",
      truncated: response.truncated ?? false,
      unknown_block_ids: response.unknown_block_ids ?? [],
    };
  }

  async updatePageProperties(
    pageId: string,
    properties: Record<string, NotionPropertyValue>
  ): Promise<NotionPageResponse> {
    return this.request<NotionPageResponse>(
      "PATCH",
      `/pages/${pageId}`,
      { properties },
      { notionVersion: MARKDOWN_NOTION_VERSION }
    );
  }

  async archivePage(pageId: string, archived = true): Promise<NotionPageResponse> {
    return this.request<NotionPageResponse>(
      "PATCH",
      `/pages/${pageId}`,
      { archived },
      { notionVersion: MARKDOWN_NOTION_VERSION }
    );
  }

  markdownToBlocks(markdown: string): NotionBlock[] {
    return markdownToBlocks(markdown);
  }

  blocksToMarkdown(blocks: NotionBlock[]): string {
    return blocksToMarkdown(blocks);
  }

  /**
   * Builds a heading_2 block followed by paragraph blocks for the given text.
   * Text is automatically split into 2,000-character chunks to satisfy Notion's limit.
   */
  static buildSectionBlocks(heading: string, body: string): NotionBlock[] {
    return [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: heading } }],
        },
      },
      ...splitIntoChunks(body, MAX_BLOCK_TEXT_LENGTH).map((chunk) => ({
        object: "block" as const,
        type: "paragraph" as const,
        paragraph: {
          rich_text: [{ type: "text" as const, text: { content: chunk } }],
        },
      })),
    ];
  }
}
