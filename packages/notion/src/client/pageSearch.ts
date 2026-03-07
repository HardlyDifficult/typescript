import type { NotionPageSearchResult, SearchPagesOptions } from "../types.js";

import type { NotionRequestFn } from "./requestFn.js";
import { MARKDOWN_NOTION_VERSION, toPageMeta } from "./shared.js";
import type { NotionSearchResponse } from "./types.js";

/** Searches pages and returns normalized metadata with pagination support. */
export async function searchPages(
  request: NotionRequestFn,
  query: string,
  options?: SearchPagesOptions
): Promise<NotionPageSearchResult[]> {
  const results: NotionPageSearchResult[] = [];
  let cursor = options?.startCursor;
  const pageSize = options?.pageSize;
  const limit = options?.limit;

  do {
    const response = await request<NotionSearchResponse>(
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

/** Returns recently edited pages (search-sorted then client-filtered). */
export async function getRecentlyModified(
  searchPagesFn: (
    query: string,
    options?: SearchPagesOptions
  ) => Promise<NotionPageSearchResult[]>,
  options?: {
    sinceMinutesAgo?: number;
    limit?: number;
  }
): Promise<NotionPageSearchResult[]> {
  const sinceMinutes = options?.sinceMinutesAgo ?? 60;
  const limit = options?.limit ?? 50;

  // Add 1-minute buffer because Notion rounds last_edited_time to the minute
  const cutoff = new Date(Date.now() - (sinceMinutes + 1) * 60 * 1000);

  const pages = await searchPagesFn("", {
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
