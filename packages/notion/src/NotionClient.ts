import { BaseNotionClient } from "./client/BaseNotionClient.js";
import { fetchBlockChildren } from "./client/blockChildren.js";
import {
  buildSectionBlocks,
  LEGACY_NOTION_VERSION,
  MARKDOWN_NOTION_VERSION,
  MAX_BLOCKS_PER_REQUEST,
  normalizeParent,
  toPageMeta,
} from "./client/shared.js";
import type {
  NotionSearchResponse,
  RawMarkdownPageResponse,
} from "./client/types.js";
import {
  blocksToMarkdown,
  markdownToBlocks,
  selectionFromMarkdown,
} from "./markdown.js";
import type {
  AppendBlocksRequest,
  CreatePageRequest,
  GetActivityFeedOptions,
  ListCommentsOptions,
  NotionActivityEvent,
  NotionApiVersion,
  NotionBlock,
  NotionCommentMeta,
  NotionCommentResponse,
  NotionListResponse,
  NotionPageContent,
  NotionPageMarkdownResponse,
  NotionPageMeta,
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

export interface NotionClientOptions {
  apiToken: string;
  fetchImpl?: typeof fetch;
  apiVersion?: NotionApiVersion;
}

function parseTimeInput(
  input: Date | string | undefined,
  fallback: Date,
  fieldName: string
): Date {
  if (input === undefined) {
    return fallback;
  }

  const parsed = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName} time: ${String(input)}`);
  }
  return parsed;
}

function toCommentMeta(comment: NotionCommentResponse): NotionCommentMeta {
  const pageId =
    comment.parent !== undefined &&
    typeof comment.parent === "object" &&
    "type" in comment.parent &&
    comment.parent.type === "page_id" &&
    "page_id" in comment.parent &&
    typeof comment.parent.page_id === "string"
      ? comment.parent.page_id
      : null;

  return {
    id: comment.id,
    pageId,
    discussionId:
      typeof comment.discussion_id === "string" ? comment.discussion_id : null,
    createdTime:
      typeof comment.created_time === "string" ? comment.created_time : null,
    lastEdited:
      typeof comment.last_edited_time === "string"
        ? comment.last_edited_time
        : null,
  };
}

/** Client for interacting with the Notion REST API. */
export class NotionClient extends BaseNotionClient {
  constructor(options: NotionClientOptions) {
    super({
      ...options,
      apiVersion: options.apiVersion ?? LEGACY_NOTION_VERSION,
    });
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
    const { parent } = normalized;

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

    const page = await this.request<NotionPageResponse>(
      "POST",
      "/pages",
      payload,
      {
        notionVersion: normalized.notionVersion,
      }
    );

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
      await this.request<unknown>(
        "PATCH",
        `/blocks/${pageId}/children`,
        payload
      );
    }
  }

  async retrieveBlockChildren(
    blockId: string,
    options?: RetrieveBlockChildrenOptions
  ): Promise<NotionBlock[]> {
    return fetchBlockChildren(
      (method, path, body, opts) => this.request(method, path, body, opts),
      blockId,
      options
    );
  }

  async getPageBlocks(
    pageId: string,
    options?: RetrieveBlockChildrenOptions
  ): Promise<NotionBlock[]> {
    return this.retrieveBlockChildren(pageId, options);
  }

  async getPageMeta(pageId: string): Promise<NotionPageMeta> {
    const page = await this.request<NotionPageResponse>(
      "GET",
      `/pages/${pageId}`,
      undefined,
      {
        notionVersion: MARKDOWN_NOTION_VERSION,
      }
    );
    return toPageMeta(page);
  }

  async readPage(
    pageId: string,
    options?: ReadPageOptions
  ): Promise<NotionPageContent> {
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
        results.push({
          ...toPageMeta(page),
          object: page.object,
        });
        if (limit !== undefined && results.length >= limit) {
          return results.slice(0, limit);
        }
      }

      cursor = response.has_more
        ? (response.next_cursor ?? undefined)
        : undefined;
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
        options.contentRange ??
        selectionFromMarkdown((await this.readPage(pageId)).markdown);
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
    const response = await this.request<
      NotionPageMarkdownResponse | RawMarkdownPageResponse
    >("PATCH", `/pages/${pageId}/markdown`, request, {
      notionVersion: MARKDOWN_NOTION_VERSION,
    });

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

  async archivePage(
    pageId: string,
    archived = true
  ): Promise<NotionPageResponse> {
    return this.request<NotionPageResponse>(
      "PATCH",
      `/pages/${pageId}`,
      { archived },
      { notionVersion: MARKDOWN_NOTION_VERSION }
    );
  }

  /** Lists comments attached to a specific block or page ID. */
  async listComments(
    blockId: string,
    options?: ListCommentsOptions
  ): Promise<NotionCommentMeta[]> {
    const comments: NotionCommentMeta[] = [];
    let cursor = options?.startCursor;
    const pageSize = options?.pageSize;
    const limit = options?.limit;

    do {
      const response = await this.request<NotionListResponse<NotionCommentResponse>>(
        "GET",
        "/comments",
        undefined,
        {
          notionVersion: MARKDOWN_NOTION_VERSION,
          query: {
            block_id: blockId,
            start_cursor: cursor,
            page_size: pageSize,
          },
        }
      );

      for (const comment of response.results) {
        comments.push(toCommentMeta(comment));
        if (limit !== undefined && comments.length >= limit) {
          return comments.slice(0, limit);
        }
      }

      cursor = response.has_more
        ? (response.next_cursor ?? undefined)
        : undefined;
    } while (cursor !== undefined);

    return comments;
  }

  /**
   * Returns an activity timeline of recently changed pages and comments.
   *
   * Notion does not currently expose a global timestamp-filtered activity feed,
   * so this method composes search + per-page comment listing and applies
   * client-side time filtering with an optional overlap window.
   */
  async getActivityFeed(
    options?: GetActivityFeedOptions
  ): Promise<NotionActivityEvent[]> {
    const now = new Date();
    const until = parseTimeInput(options?.until, now, "until");
    const sinceDefault = new Date(until.getTime() - 60 * 60 * 1000);
    const since = parseTimeInput(options?.since, sinceDefault, "since");

    if (since > until) {
      throw new Error("`since` must be before or equal to `until`");
    }

    const overlapMinutes = Math.max(options?.overlapMinutes ?? 1, 0);
    const overlapMs = overlapMinutes * 60 * 1000;
    const lowerBound = new Date(since.getTime() - overlapMs);
    const upperBoundMs = until.getTime();
    const lowerBoundMs = lowerBound.getTime();
    const limit = options?.limit ?? 100;
    const includePages = options?.includePages ?? true;
    const includeComments = options?.includeComments ?? true;

    if (limit <= 0 || (!includePages && !includeComments)) {
      return [];
    }

    const pages = await this.searchPages("", {
      sort: { direction: "descending", timestamp: "last_edited_time" },
      pageSize: options?.pageSize,
      filter: { property: "object", value: "page" },
    });

    const candidatePages: NotionPageSearchResult[] = [];
    for (const page of pages) {
      if (page.lastEdited === null) {
        continue;
      }
      const editedAt = new Date(page.lastEdited).getTime();
      if (Number.isNaN(editedAt) || editedAt > upperBoundMs) {
        continue;
      }
      if (editedAt < lowerBoundMs) {
        break;
      }
      candidatePages.push(page);
    }

    const events: NotionActivityEvent[] = [];

    if (includePages) {
      for (const page of candidatePages) {
        if (page.lastEdited === null) {
          continue;
        }
        events.push({
          kind: "page",
          eventId: `page:${page.id}:${page.lastEdited}`,
          timestamp: page.lastEdited,
          page,
        });
      }
    }

    if (includeComments) {
      for (const page of candidatePages) {
        const comments = await this.listComments(page.id, {
          pageSize: options?.pageSize,
        });
        for (const comment of comments) {
          const eventTime = comment.lastEdited ?? comment.createdTime;
          if (eventTime === null) {
            continue;
          }
          const eventTimeMs = new Date(eventTime).getTime();
          if (
            Number.isNaN(eventTimeMs) ||
            eventTimeMs < lowerBoundMs ||
            eventTimeMs > upperBoundMs
          ) {
            continue;
          }
          events.push({
            kind: "comment",
            eventId: `comment:${comment.id}:${eventTime}`,
            timestamp: eventTime,
            pageId: comment.pageId,
            comment,
          });
        }
      }
    }

    events.sort((a, b) => {
      const delta = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (delta !== 0) {
        return delta;
      }
      return a.eventId.localeCompare(b.eventId);
    });

    return events.slice(0, limit);
  }

  /** Returns recently edited pages (search-sorted then client-filtered). */
  async getRecentlyModified(options?: {
    sinceMinutesAgo?: number;
    limit?: number;
  }): Promise<NotionPageSearchResult[]> {
    const sinceMinutes = options?.sinceMinutesAgo ?? 60;
    const limit = options?.limit ?? 50;

    // Add 1-minute buffer because Notion rounds last_edited_time to the minute
    const cutoff = new Date(Date.now() - (sinceMinutes + 1) * 60 * 1000);

    const pages = await this.searchPages("", {
      sort: { direction: "descending", timestamp: "last_edited_time" },
    });

    const results: NotionPageSearchResult[] = [];
    for (const page of pages) {
      if (page.lastEdited === null) {
        continue;
      }
      if (new Date(page.lastEdited) < cutoff) {
        break;
      }
      results.push(page);
      if (results.length >= limit) {
        break;
      }
    }

    return results;
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
    return buildSectionBlocks(heading, body);
  }
}
