import {
  getActivityFeed as getActivityFeedImpl,
  listComments as listCommentsImpl,
} from "./client/activityFeed.js";
import { BaseNotionClient } from "./client/BaseNotionClient.js";
import { fetchBlockChildren } from "./client/blockChildren.js";
import {
  getPageMeta as getPageMetaImpl,
  readPage as readPageImpl,
  updatePage as updatePageImpl,
  updatePageMarkdown as updatePageMarkdownImpl,
} from "./client/pageContent.js";
import {
  appendBlocks as appendBlocksImpl,
  archivePage as archivePageImpl,
  createPage as createPageImpl,
  createPageMarkdown as createPageMarkdownImpl,
  updatePageProperties as updatePagePropertiesImpl,
} from "./client/pageCrud.js";
import {
  getRecentlyModified as getRecentlyModifiedImpl,
  searchPages as searchPagesImpl,
} from "./client/pageSearch.js";
import { buildSectionBlocks, LEGACY_NOTION_VERSION } from "./client/shared.js";
import { blocksToMarkdown, markdownToBlocks } from "./markdown.js";
import type {
  GetActivityFeedOptions,
  ListCommentsOptions,
  NotionActivityEvent,
  NotionApiVersion,
  NotionBlock,
  NotionCommentMeta,
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
    return createPageImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      (markdown) => this.markdownToBlocks(markdown),
      (pageId, blocks) => this.appendBlocks(pageId, blocks),
      parentOrDatabaseId,
      properties,
      content
    );
  }

  async createPageMarkdown(
    parent: Exclude<NotionParent, { type: "database_id" }>,
    markdown: string,
    properties: Record<string, NotionPropertyValue> = {}
  ): Promise<NotionPageResponse> {
    return createPageMarkdownImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      parent,
      markdown,
      properties
    );
  }

  /** Appends blocks to an existing page, batching to respect the 100-block limit. */
  async appendBlocks(pageId: string, blocks: NotionBlock[]): Promise<void> {
    return appendBlocksImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      pageId,
      blocks
    );
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
    return getPageMetaImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      pageId
    );
  }

  async readPage(
    pageId: string,
    options?: ReadPageOptions
  ): Promise<NotionPageContent> {
    return readPageImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      (targetPageId) => this.getPageMeta(targetPageId),
      (targetPageId, blockOptions) =>
        this.getPageBlocks(targetPageId, blockOptions),
      (blocks) => this.blocksToMarkdown(blocks),
      pageId,
      options
    );
  }

  async searchPages(
    query: string,
    options?: SearchPagesOptions
  ): Promise<NotionPageSearchResult[]> {
    return searchPagesImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      query,
      options
    );
  }

  async updatePage(
    pageId: string,
    content: string,
    options?: UpdatePageOptions
  ): Promise<NotionPageMarkdownResponse> {
    return updatePageImpl(
      (targetPageId) => this.readPage(targetPageId),
      (targetPageId, request) => this.updatePageMarkdown(targetPageId, request),
      pageId,
      content,
      options
    );
  }

  async updatePageMarkdown(
    pageId: string,
    request: UpdatePageMarkdownRequest
  ): Promise<NotionPageMarkdownResponse> {
    return updatePageMarkdownImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      pageId,
      request
    );
  }

  async updatePageProperties(
    pageId: string,
    properties: Record<string, NotionPropertyValue>
  ): Promise<NotionPageResponse> {
    return updatePagePropertiesImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      pageId,
      properties
    );
  }

  async archivePage(
    pageId: string,
    archived = true
  ): Promise<NotionPageResponse> {
    return archivePageImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      pageId,
      archived
    );
  }

  /** Lists comments attached to a specific block or page ID. */
  async listComments(
    blockId: string,
    options?: ListCommentsOptions
  ): Promise<NotionCommentMeta[]> {
    return listCommentsImpl(
      (method, path, body, opts) => this.request(method, path, body, opts),
      blockId,
      options
    );
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
    return getActivityFeedImpl(
      (query, searchOptions) => this.searchPages(query, searchOptions),
      (blockId, commentOptions) => this.listComments(blockId, commentOptions),
      options
    );
  }

  /** Returns recently edited pages (search-sorted then client-filtered). */
  async getRecentlyModified(options?: {
    sinceMinutesAgo?: number;
    limit?: number;
  }): Promise<NotionPageSearchResult[]> {
    return getRecentlyModifiedImpl(
      (query, searchOptions) => this.searchPages(query, searchOptions),
      options
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
    return buildSectionBlocks(heading, body);
  }
}
