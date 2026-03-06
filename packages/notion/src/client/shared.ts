import { richTextToPlainText } from "../markdown.js";
import type {
  CreatePageRequest,
  NotionApiVersion,
  NotionPageMeta,
  NotionPagePropertyMap,
  NotionPageResponse,
  NotionParent,
  NotionRichText,
} from "../types.js";

export const LEGACY_NOTION_VERSION = "2022-06-28";
export const MARKDOWN_NOTION_VERSION = "2025-09-03";

/** Maximum characters per Notion rich text block. */
export const MAX_BLOCK_TEXT_LENGTH = 2000;

/** Maximum blocks per API request. */
export const MAX_BLOCKS_PER_REQUEST = 100;

function buildLegacyParent(databaseId: string): { database_id: string } {
  return { database_id: databaseId };
}

function isTitleProperty(
  property: NotionPagePropertyMap[string]
): property is { type: "title"; title: NotionRichText[] } {
  return (
    property.type === "title" &&
    "title" in property &&
    Array.isArray(property.title)
  );
}

/** Splits long text into chunks that fit within Notion's block limit. */
export function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }
  return chunks;
}

/** Normalizes a caller-provided parent into the REST payload shape. */
export function normalizeParent(parent: NotionParent | string): {
  parent: CreatePageRequest["parent"];
  notionVersion: NotionApiVersion;
} {
  if (typeof parent === "string") {
    return {
      parent: buildLegacyParent(parent),
      notionVersion: LEGACY_NOTION_VERSION,
    };
  }

  if (parent.type === "data_source_id") {
    return {
      parent,
      notionVersion: MARKDOWN_NOTION_VERSION,
    };
  }

  if (parent.type === "database_id") {
    return {
      parent: buildLegacyParent(parent.database_id),
      notionVersion: LEGACY_NOTION_VERSION,
    };
  }

  if (parent.type === "page_id") {
    return {
      parent: { page_id: parent.page_id },
      notionVersion: LEGACY_NOTION_VERSION,
    };
  }

  return {
    parent: { workspace: true },
    notionVersion: LEGACY_NOTION_VERSION,
  };
}

/** Extracts the visible page title from a Notion properties map. */
export function extractPageTitle(properties?: NotionPagePropertyMap): string {
  if (properties === undefined) {
    return "";
  }

  for (const property of Object.values(properties)) {
    if (isTitleProperty(property)) {
      return richTextToPlainText(property.title);
    }
  }

  return "";
}

/** Converts a raw page response into the package's normalized metadata shape. */
export function toPageMeta(page: NotionPageResponse): NotionPageMeta {
  return {
    id: page.id,
    title: extractPageTitle(page.properties),
    url: page.url,
    lastEdited: page.last_edited_time ?? null,
    createdTime: page.created_time ?? null,
    archived: page.archived ?? false,
    inTrash: page.in_trash ?? false,
    parent: page.parent,
    properties: page.properties ?? {},
    icon: page.icon ?? null,
    cover: page.cover ?? null,
  };
}
