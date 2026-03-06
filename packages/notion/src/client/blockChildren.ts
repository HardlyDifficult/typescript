import type { NotionBlock, RetrieveBlockChildrenOptions } from "../types.js";

interface PaginatedBlockResponse {
  object: "list";
  results: NotionBlock[];
  next_cursor: string | null;
  has_more: boolean;
}

import type { RequestOptions } from "./types.js";

type RequestFn = <T>(
  method: "GET" | "PATCH" | "POST",
  path: string,
  body?: unknown,
  options?: RequestOptions
) => Promise<T>;

/**
 * Fetches all children of a block, optionally recursing into nested blocks.
 * The switch statement attaches children to the correct block-type property.
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
    const response = await requestFn<PaginatedBlockResponse>(
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
      const nextBlock = block;
      if (
        options?.recursive === true &&
        block.has_children === true &&
        block.id !== undefined
      ) {
        const children = await fetchBlockChildren(requestFn, block.id, {
          ...options,
          startCursor: undefined,
        });
        attachChildren(nextBlock, children);
      }
      results.push(nextBlock);
    }

    cursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (cursor !== undefined);

  return results;
}

/** Attaches child blocks to the correct property based on block type. */
function attachChildren(block: NotionBlock, children: NotionBlock[]): void {
  switch (block.type) {
    case "paragraph":
      block.paragraph = { ...block.paragraph, children };
      break;
    case "bulleted_list_item":
      block.bulleted_list_item = {
        ...block.bulleted_list_item,
        children,
      };
      break;
    case "numbered_list_item":
      block.numbered_list_item = {
        ...block.numbered_list_item,
        children,
      };
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
