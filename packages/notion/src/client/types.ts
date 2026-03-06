import type { NotionApiVersion, NotionPageResponse } from "../types.js";

export interface RequestOptions {
  notionVersion?: NotionApiVersion;
  query?: Record<string, boolean | number | string | undefined>;
}

export interface NotionSearchResponse {
  object: "list";
  results: NotionPageResponse[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface RawMarkdownPageResponse extends NotionPageResponse {
  markdown?: string;
  content?: string;
  truncated?: boolean;
  unknown_block_ids?: string[];
}
