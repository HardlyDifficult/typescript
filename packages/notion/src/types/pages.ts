import type { NotionBlock } from "./blocks.js";
import type { NotionApiVersion } from "./common.js";
import type {
  NotionIcon,
  NotionPropertyInput,
  NotionPropertyValue,
} from "./properties.js";

export interface NotionDatabaseParent {
  type: "database_id";
  database_id: string;
}

export interface NotionDataSourceParent {
  type: "data_source_id";
  data_source_id: string;
}

export interface NotionPageParent {
  type: "page_id";
  page_id: string;
}

export interface NotionWorkspaceParent {
  type: "workspace";
  workspace: true;
}

export type NotionParent =
  | NotionDatabaseParent
  | NotionDataSourceParent
  | NotionPageParent
  | NotionWorkspaceParent;

export interface CreatePageRequest {
  parent:
    | NotionParent
    | { database_id: string }
    | { page_id: string }
    | { workspace: true };
  properties?: Record<string, NotionPropertyValue>;
  children?: NotionBlock[];
  markdown?: string;
}

export type NotionPagePropertyMap = Record<
  string,
  {
    id?: string;
    type?: string;
    [key: string]: unknown;
  }
>;

export interface NotionPageResponse {
  object?: "page";
  id: string;
  url: string;
  parent?: NotionParent | Record<string, unknown>;
  properties?: NotionPagePropertyMap;
  last_edited_time?: string;
  created_time?: string;
  archived?: boolean;
  in_trash?: boolean;
  icon?: NotionIcon | null;
  cover?: Record<string, unknown> | null;
}

export interface NotionPageMeta {
  id: string;
  title: string;
  url: string;
  lastEdited: string | null;
  createdTime: string | null;
  archived: boolean;
  inTrash: boolean;
  parent?: NotionParent | Record<string, unknown>;
  properties: NotionPagePropertyMap;
  icon?: NotionIcon | null;
  cover?: Record<string, unknown> | null;
}

export interface NotionPageMarkdownResponse {
  object: "page_markdown";
  id: string;
  markdown: string;
  truncated: boolean;
  unknown_block_ids: string[];
}

export interface NotionPageContent extends NotionPageMeta {
  markdown: string;
  truncated: boolean;
  unknownBlockIds: string[];
}

export interface NotionPageSearchResult extends NotionPageMeta {
  object?: "page";
}

export interface NotionCommentParent {
  type: "page_id";
  page_id: string;
}

export interface NotionCommentResponse {
  object: "comment";
  id: string;
  parent: NotionCommentParent | Record<string, unknown>;
  discussion_id?: string;
  rich_text?: unknown[];
  created_time?: string;
  last_edited_time?: string;
}

export interface NotionCommentMeta {
  id: string;
  pageId: string | null;
  discussionId: string | null;
  createdTime: string | null;
  lastEdited: string | null;
}

export interface NotionCommentActivityEvent {
  kind: "comment";
  eventId: string;
  timestamp: string;
  pageId: string | null;
  comment: NotionCommentMeta;
}

export interface NotionPageActivityEvent {
  kind: "page";
  eventId: string;
  timestamp: string;
  page: NotionPageSearchResult;
}

export type NotionActivityEvent =
  | NotionCommentActivityEvent
  | NotionPageActivityEvent;

export interface AppendBlocksRequest {
  children: NotionBlock[];
}

export interface NotionListResponse<T> {
  object: "list";
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface NotionSearchFilter {
  property: "object";
  value: "page" | "data_source";
}

export interface NotionSearchSort {
  direction: "ascending" | "descending";
  timestamp: "last_edited_time";
}

export interface SearchPagesOptions {
  limit?: number;
  pageSize?: number;
  startCursor?: string;
  filter?: NotionSearchFilter;
  sort?: NotionSearchSort;
}

export interface ListCommentsOptions {
  limit?: number;
  pageSize?: number;
  startCursor?: string;
}

export interface GetActivityFeedOptions {
  since?: Date | string;
  until?: Date | string;
  overlapMinutes?: number;
  limit?: number;
  pageSize?: number;
  includePages?: boolean;
  includeComments?: boolean;
}

export interface RetrieveBlockChildrenOptions {
  recursive?: boolean;
  pageSize?: number;
  startCursor?: string;
}

export interface ReadPageOptions {
  includeTranscript?: boolean;
  fallbackToBlocks?: boolean;
}

export interface NotionMarkdownRenderable {
  toMarkdown(): string;
}

export type NotionMarkdownContent = string | NotionMarkdownRenderable;
export type NotionPageBody = NotionBlock[] | NotionMarkdownContent;

export interface NotionPageDraft {
  parent: NotionParent | string;
  title?: string;
  titleProperty?: string;
  properties?: Record<string, NotionPropertyInput>;
  content?: NotionMarkdownContent;
  blocks?: NotionBlock[];
}

export interface AppendPageMarkdownOptions {
  after?: string;
}

export interface ReplacePageMarkdownOptions {
  contentRange?: string;
  allowDeletingContent?: boolean;
}

export interface InsertContentMarkdownRequest {
  type: "insert_content";
  insert_content: {
    content: string;
    after?: string;
  };
}

export interface ReplaceContentRangeMarkdownRequest {
  type: "replace_content_range";
  replace_content_range: {
    content: string;
    content_range: string;
    allow_deleting_content?: boolean;
  };
}

export type UpdatePageMarkdownRequest =
  | InsertContentMarkdownRequest
  | ReplaceContentRangeMarkdownRequest;

export interface UpdatePageOptions
  extends AppendPageMarkdownOptions, ReplacePageMarkdownOptions {
  replace?: boolean;
}

export interface NotionClientOptions {
  apiToken: string;
  fetchImpl?: typeof fetch;
  apiVersion?: NotionApiVersion;
}
