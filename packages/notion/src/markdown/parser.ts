import type {
  NotionBlock,
  NotionColor,
  NotionSyncedBlock,
  NotionTableOfContentsBlock,
} from "../types.js";

import {
  parseCodeFence,
  parseEquation,
  parseHeading,
  parseListBlock,
  parseListMarker,
  parseMediaBlock,
  parseParagraph,
  parseQuote,
  type ParseResult,
} from "./blocks.js";
import { richTextFromMarkdown } from "./richText.js";
import { BLANK_LINE, normalizeMarkdown } from "./shared.js";

function parseDetails(lines: string[], startIndex: number): ParseResult {
  let index = startIndex + 1;
  let summary = "Details";

  const summaryLine = lines[index]?.trim() ?? "";
  const summaryMatch = /^<summary>(.*)<\/summary>$/.exec(summaryLine);
  if (summaryMatch !== null) {
    summary = summaryMatch[1];
    index += 1;
  }

  return {
    blocks: [
      {
        object: "block",
        type: "toggle",
        toggle: {
          rich_text: richTextFromMarkdown(summary),
          children: markdownToBlocks(collectUntil(lines, index, "</details>")),
        },
      },
    ],
    nextIndex: consumeUntil(lines, index, "</details>"),
  };
}

function parseCallout(lines: string[], startIndex: number): ParseResult {
  const opening = lines[startIndex]?.trim() ?? "";
  const iconMatch = /\[icon=(.+?)\]/.exec(opening);
  const colorMatch = /color="([^"]+)"/.exec(opening);
  const color = colorMatch?.[1] as NotionColor | undefined;
  const bodyStart = startIndex + 1;
  const children = markdownToBlocks(collectUntil(lines, bodyStart, ":::"));
  const first = children.at(0);
  const rest = children.slice(1);
  const leadParagraph = first?.type === "paragraph" ? first : undefined;
  const richText =
    leadParagraph === undefined ? [] : leadParagraph.paragraph.rich_text;
  const nestedChildren = leadParagraph !== undefined ? rest : children;

  return {
    blocks: [
      {
        object: "block",
        type: "callout",
        callout: {
          rich_text: richText,
          color,
          icon:
            iconMatch?.[1] !== undefined
              ? { type: "emoji", emoji: iconMatch[1] }
              : undefined,
          children: nestedChildren.length > 0 ? nestedChildren : undefined,
        },
      },
    ],
    nextIndex: consumeUntil(lines, bodyStart, ":::"),
  };
}

function collectUntil(
  lines: string[],
  startIndex: number,
  closingLine: string
): string {
  const body: string[] = [];
  let index = startIndex;
  while (index < lines.length && (lines[index]?.trim() ?? "") !== closingLine) {
    body.push(lines[index] ?? "");
    index += 1;
  }
  return body.join("\n");
}

function consumeUntil(
  lines: string[],
  startIndex: number,
  closingLine: string
): number {
  let index = startIndex;
  while (index < lines.length && (lines[index]?.trim() ?? "") !== closingLine) {
    index += 1;
  }
  return Math.min(index + 1, lines.length);
}

function parseBlocks(lines: string[], startIndex = 0): ParseResult {
  const blocks: NotionBlock[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (BLANK_LINE.test(line)) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const parsed = parseCodeFence(lines, index);
      blocks.push(...parsed.blocks);
      index = parsed.nextIndex;
      continue;
    }

    if (trimmed === "<details>") {
      const parsed = parseDetails(lines, index);
      blocks.push(...parsed.blocks);
      index = parsed.nextIndex;
      continue;
    }

    if (/^:::\s*callout/.test(trimmed)) {
      const parsed = parseCallout(lines, index);
      blocks.push(...parsed.blocks);
      index = parsed.nextIndex;
      continue;
    }

    if (trimmed === "<table_of_contents/>") {
      blocks.push({
        object: "block",
        type: "table_of_contents",
        table_of_contents: {},
      } satisfies NotionTableOfContentsBlock);
      index += 1;
      continue;
    }

    if (trimmed === "<synced_block>") {
      const children = markdownToBlocks(
        collectUntil(lines, index + 1, "</synced_block>")
      );
      blocks.push({
        object: "block",
        type: "synced_block",
        synced_block: { children },
      } satisfies NotionSyncedBlock);
      index = consumeUntil(lines, index + 1, "</synced_block>");
      continue;
    }

    if (trimmed.startsWith("$$")) {
      const parsed = parseEquation(lines, index);
      blocks.push(...parsed.blocks);
      index = parsed.nextIndex;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({
        object: "block",
        type: "divider",
        divider: {},
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const parsed = parseQuote(lines, index);
      blocks.push(...parsed.blocks);
      index = parsed.nextIndex;
      continue;
    }

    const heading = parseHeading(line);
    if (heading !== null) {
      blocks.push(heading);
      index += 1;
      continue;
    }

    const media = parseMediaBlock(line);
    if (media !== null) {
      blocks.push(media);
      index += 1;
      continue;
    }

    const marker = parseListMarker(line);
    if (marker !== null) {
      const parsed = parseListBlock(lines, index, marker.indent);
      blocks.push(...parsed.blocks);
      index = parsed.nextIndex;
      continue;
    }

    const parsed = parseParagraph(lines, index);
    blocks.push(...parsed.blocks);
    index = parsed.nextIndex;
  }

  return { blocks, nextIndex: index };
}

/** Converts supported markdown structures into Notion block payloads. */
export function markdownToBlocks(markdown: string): NotionBlock[] {
  const normalized = normalizeMarkdown(markdown);
  if (normalized.length === 0) {
    return [];
  }
  return parseBlocks(normalized.split("\n")).blocks;
}
