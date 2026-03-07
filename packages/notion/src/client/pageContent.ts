import { NotionApiError } from "../NotionApiError.js";
import { selectionFromMarkdown } from "../markdown.js";
import type {
  NotionBlock,
  NotionPageContent,
  NotionPageMarkdownResponse,
  NotionPageMeta,
  ReadPageOptions,
  RetrieveBlockChildrenOptions,
  UpdatePageMarkdownRequest,
  UpdatePageOptions,
} from "../types.js";

import type { NotionRequestFn } from "./requestFn.js";
import { MARKDOWN_NOTION_VERSION, toPageMeta } from "./shared.js";
import type { RawMarkdownPageResponse } from "./types.js";

function shouldFallbackToBlocks(error: unknown): boolean {
  if (!(error instanceof NotionApiError) || error.status !== 400) {
    return false;
  }

  const body = error.body.toLowerCase();
  return (
    body.includes("unsupported version") && body.includes("markdown")
  ) || body.includes("content_format");
}

/** Retrieves normalized metadata for a page ID. */
export async function getPageMeta(
  request: NotionRequestFn,
  pageId: string
): Promise<NotionPageMeta> {
  const page = await request<RawMarkdownPageResponse>(
    "GET",
    `/pages/${pageId}`,
    undefined,
    {
      notionVersion: MARKDOWN_NOTION_VERSION,
    }
  );
  return toPageMeta(page);
}

/** Reads a page as markdown, optionally falling back to recursive block reads. */
export async function readPage(
  request: NotionRequestFn,
  getPageMetaFn: (pageId: string) => Promise<NotionPageMeta>,
  getPageBlocksFn: (
    pageId: string,
    options?: RetrieveBlockChildrenOptions
  ) => Promise<NotionBlock[]>,
  blocksToMarkdown: (blocks: NotionBlock[]) => string,
  pageId: string,
  options?: ReadPageOptions
): Promise<NotionPageContent> {
  const fallbackToBlocks = options?.fallbackToBlocks ?? true;

  try {
    const page = await request<RawMarkdownPageResponse>(
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
    if (!fallbackToBlocks || !shouldFallbackToBlocks(error)) {
      throw error;
    }

    const [meta, blocks] = await Promise.all([
      getPageMetaFn(pageId),
      getPageBlocksFn(pageId, { recursive: true }),
    ]);

    return {
      ...meta,
      markdown: blocksToMarkdown(blocks),
      truncated: false,
      unknownBlockIds: [],
    };
  }
}

/** Inserts or replaces markdown content on a page. */
export async function updatePage(
  readPageFn: (pageId: string) => Promise<NotionPageContent>,
  updatePageMarkdownFn: (
    pageId: string,
    request: UpdatePageMarkdownRequest
  ) => Promise<NotionPageMarkdownResponse>,
  pageId: string,
  content: string,
  options?: UpdatePageOptions
): Promise<NotionPageMarkdownResponse> {
  if (options?.replace === true) {
    const contentRange =
      options.contentRange ??
      selectionFromMarkdown((await readPageFn(pageId)).markdown);
    if (contentRange === undefined) {
      return updatePageMarkdownFn(pageId, {
        type: "insert_content",
        insert_content: { content, after: options.after },
      });
    }
    return updatePageMarkdownFn(pageId, {
      type: "replace_content_range",
      replace_content_range: {
        content,
        content_range: contentRange,
        allow_deleting_content: options.allowDeletingContent,
      },
    });
  }

  return updatePageMarkdownFn(pageId, {
    type: "insert_content",
    insert_content: {
      content,
      after: options?.after,
    },
  });
}

/** Calls the markdown page update endpoint and normalizes legacy responses. */
export async function updatePageMarkdown(
  request: NotionRequestFn,
  pageId: string,
  updateRequest: UpdatePageMarkdownRequest
): Promise<NotionPageMarkdownResponse> {
  const response = await request<
    NotionPageMarkdownResponse | RawMarkdownPageResponse
  >("PATCH", `/pages/${pageId}/markdown`, updateRequest, {
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
