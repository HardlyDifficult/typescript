import type {
  GetActivityFeedOptions,
  ListCommentsOptions,
  NotionActivityEvent,
  NotionCommentMeta,
  NotionCommentResponse,
  NotionListResponse,
  NotionPageSearchResult,
  SearchPagesOptions,
} from "../types.js";

import type { NotionRequestFn } from "./requestFn.js";
import { MARKDOWN_NOTION_VERSION } from "./shared.js";

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

/** Lists comments for a block/page and normalizes comment metadata. */
export async function listComments(
  request: NotionRequestFn,
  blockId: string,
  options?: ListCommentsOptions
): Promise<NotionCommentMeta[]> {
  const comments: NotionCommentMeta[] = [];
  let cursor = options?.startCursor;
  const pageSize = options?.pageSize;
  const limit = options?.limit;

  do {
    const response = await request<NotionListResponse<NotionCommentResponse>>(
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

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
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
export async function getActivityFeed(
  searchPagesFn: (
    query: string,
    options?: SearchPagesOptions
  ) => Promise<NotionPageSearchResult[]>,
  listCommentsFn: (
    blockId: string,
    options?: ListCommentsOptions
  ) => Promise<NotionCommentMeta[]>,
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

  const pages = await searchPagesFn("", {
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
      const comments = await listCommentsFn(page.id, {
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
