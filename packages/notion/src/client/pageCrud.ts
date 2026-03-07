import type {
  AppendBlocksRequest,
  CreatePageRequest,
  NotionBlock,
  NotionPageResponse,
  NotionParent,
  NotionPropertyValue,
} from "../types.js";

import type { NotionRequestFn } from "./requestFn.js";
import {
  MARKDOWN_NOTION_VERSION,
  MAX_BLOCKS_PER_REQUEST,
  normalizeParent,
} from "./shared.js";

/** Creates a page with optional markdown/block content and legacy compatibility. */
export async function createPage(
  request: NotionRequestFn,
  markdownToBlocks: (markdown: string) => NotionBlock[],
  appendBlocksFn: (pageId: string, blocks: NotionBlock[]) => Promise<void>,
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
    return request<NotionPageResponse>(
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
    typeof content === "string" ? markdownToBlocks(content) : content;
  const firstBatch = bodyBlocks?.slice(0, MAX_BLOCKS_PER_REQUEST);

  const payload: CreatePageRequest = {
    parent,
    properties,
    ...(firstBatch !== undefined && firstBatch.length > 0
      ? { children: firstBatch }
      : {}),
  };

  const page = await request<NotionPageResponse>("POST", "/pages", payload, {
    notionVersion: normalized.notionVersion,
  });

  const remaining = bodyBlocks?.slice(MAX_BLOCKS_PER_REQUEST) ?? [];
  if (remaining.length > 0) {
    await appendBlocksFn(page.id, remaining);
  }

  return page;
}

/** Creates a page using Notion's markdown create endpoint. */
export async function createPageMarkdown(
  request: NotionRequestFn,
  parent: Exclude<NotionParent, { type: "database_id" }>,
  markdown: string,
  properties: Record<string, NotionPropertyValue> = {}
): Promise<NotionPageResponse> {
  const normalized = normalizeParent(parent);
  return request<NotionPageResponse>(
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

/** Appends blocks to a page in 100-block batches. */
export async function appendBlocks(
  request: NotionRequestFn,
  pageId: string,
  blocks: NotionBlock[]
): Promise<void> {
  for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
    const batch = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);
    const payload: AppendBlocksRequest = { children: batch };
    await request<unknown>("PATCH", `/blocks/${pageId}/children`, payload);
  }
}

/** Updates one or more page properties. */
export async function updatePageProperties(
  request: NotionRequestFn,
  pageId: string,
  properties: Record<string, NotionPropertyValue>
): Promise<NotionPageResponse> {
  return request<NotionPageResponse>(
    "PATCH",
    `/pages/${pageId}`,
    { properties },
    { notionVersion: MARKDOWN_NOTION_VERSION }
  );
}

/** Archives or unarchives a page. */
export async function archivePage(
  request: NotionRequestFn,
  pageId: string,
  archived = true
): Promise<NotionPageResponse> {
  return request<NotionPageResponse>(
    "PATCH",
    `/pages/${pageId}`,
    { archived },
    { notionVersion: MARKDOWN_NOTION_VERSION }
  );
}
