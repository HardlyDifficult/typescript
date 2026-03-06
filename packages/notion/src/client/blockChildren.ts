import type { NotionBlock, RetrieveBlockChildrenOptions } from "../types.js";

import type { RequestOptions } from "./types.js";

type RequestFn = <T>(
  method: "GET" | "PATCH" | "POST",
  path: string,
  body?: unknown,
  options?: RequestOptions
) => Promise<T>;

interface BlockChildrenResponse {
  object: "list";
  results: NotionBlock[];
  next_cursor: string | null;
  has_more: boolean;
}

function attachChildren(block: NotionBlock, children: NotionBlock[]): void {
  switch (block.type) {
    case "paragraph":
      block.paragraph = { ...block.paragraph, children };
      break;
    case "bulleted_list_item":
      block.bulleted_list_item = { ...block.bulleted_list_item, children };
      break;
    case "numbered_list_item":
      block.numbered_list_item = { ...block.numbered_list_item, children };
      break;
    case "to_do":
      block.to_do = { ...block.to_do, children };
      break;
    case "toggle":
      block.toggle = { ...block.toggle, children };
      break;
    case "quote":
      block.quote = { ...block.quote, children };
      break;
    case "callout":
      block.callout = { ...block.callout, children };
      break;
    case "synced_block":
      block.synced_block = { ...block.synced_block, children };
      break;
    default:
      break;
  }
}

/**
 * Fetches all block children, optionally recursing into nested blocks.
 *
 * Extracted from `NotionClient.retrieveBlockChildren` to keep the main
 * client file under the ESLint max-lines limit.
 */
export async function fetchBlockChildren(
  requestFn: RequestFn,
  blockId: string,
  options?: RetrieveBlockChildrenOptions
): Promise<NotionBlock[]> {
  const results: NotionBlock[] = [];
  let cursor = options?.startCursor;
  const pageSize = options?.pageSize;

  do {
    const response = await requestFn<BlockChildrenResponse>(
      "GET",
      `/blocks/${blockId}/children`,
      undefined,
      {
        query: {
          page_size: pageSize,
          start_cursor: cursor,
        },
      }
    );

    for (const block of response.results) {
      if (
        options?.recursive === true &&
        block.has_children === true &&
        block.id !== undefined
      ) {
        const children = await fetchBlockChildren(requestFn, block.id, {
          ...options,
          startCursor: undefined,
        });
        attachChildren(block, children);
      }
      results.push(block);
    }

    cursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (cursor !== undefined);

  return results;
}
