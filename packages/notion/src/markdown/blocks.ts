import type {
  NotionBlock,
  NotionBulletedListItemBlock,
  NotionHeading1Block,
  NotionHeading2Block,
  NotionHeading3Block,
  NotionNumberedListItemBlock,
  NotionToDoBlock,
} from "../types.js";

import { makeTextRichText, richTextFromMarkdown } from "./richText.js";
import { BLANK_LINE } from "./shared.js";

export interface ParseResult {
  blocks: NotionBlock[];
  nextIndex: number;
}

interface ListMarker {
  indent: number;
  type: "bulleted_list_item" | "numbered_list_item" | "to_do";
  text: string;
  checked?: boolean;
}

/** Parses a markdown heading line into a Notion heading block. */
export function parseHeading(
  line: string
): NotionHeading1Block | NotionHeading2Block | NotionHeading3Block | null {
  const match = /^(#{1,3})\s+(.*)$/.exec(line.trim());
  if (match === null) {
    return null;
  }
  const richText = richTextFromMarkdown(match[2]);
  switch (match[1].length) {
    case 1:
      return { object: "block", type: "heading_1", heading_1: { rich_text: richText } };
    case 2:
      return { object: "block", type: "heading_2", heading_2: { rich_text: richText } };
    default:
      return { object: "block", type: "heading_3", heading_3: { rich_text: richText } };
  }
}

/** Parses a list marker line into a normalized list descriptor. */
export function parseListMarker(line: string): ListMarker | null {
  const todo = /^(\s*)-\s+\[([ xX])\]\s+(.*)$/.exec(line);
  if (todo !== null) {
    return {
      indent: todo[1].length,
      type: "to_do",
      checked: todo[2].toLowerCase() === "x",
      text: todo[3],
    };
  }

  const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
  if (bullet !== null) {
    return {
      indent: bullet[1].length,
      type: "bulleted_list_item",
      text: bullet[2],
    };
  }

  const numbered = /^(\s*)\d+\.\s+(.*)$/.exec(line);
  if (numbered !== null) {
    return {
      indent: numbered[1].length,
      type: "numbered_list_item",
      text: numbered[2],
    };
  }

  return null;
}

/** Parses a markdown paragraph block. */
export function parseParagraph(lines: string[], startIndex: number): ParseResult {
  const collected: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (
      BLANK_LINE.test(line) ||
      parseHeading(line) !== null ||
      parseListMarker(line) !== null ||
      trimmed.startsWith("```") ||
      trimmed.startsWith(">") ||
      /^---+$/.test(trimmed) ||
      trimmed === "<details>" ||
      /^:::\s*callout/.test(trimmed) ||
      /^<table_of_contents\s*\/>\s*$/.test(trimmed) ||
      /^<(file|video|audio|pdf|embed|bookmark)\b/.test(trimmed) ||
      /^!\[.*\]\(.*\)\s*$/.test(trimmed) ||
      /^<(page|database)\b/.test(trimmed) ||
      trimmed.startsWith("$$")
    ) {
      break;
    }
    collected.push(trimmed);
    index += 1;
  }

  return {
    blocks: [
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: richTextFromMarkdown(collected.join("\n")) },
      },
    ],
    nextIndex: index,
  };
}

/** Parses a fenced code block. */
export function parseCodeFence(lines: string[], startIndex: number): ParseResult {
  const opening = lines[startIndex]?.trim() ?? "";
  const language = opening.replace(/^```/, "").trim();
  const body: string[] = [];
  let index = startIndex + 1;

  while (index < lines.length && !(lines[index]?.trim() ?? "").startsWith("```")) {
    body.push(lines[index] ?? "");
    index += 1;
  }

  return {
    blocks: [
      {
        object: "block",
        type: "code",
        code: {
          rich_text: [makeTextRichText(body.join("\n"))],
          language: language.length > 0 ? language : "plain text",
        },
      },
    ],
    nextIndex: Math.min(index + 1, lines.length),
  };
}

/** Parses a blockquote. */
export function parseQuote(lines: string[], startIndex: number): ParseResult {
  const quoteLines: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (!line.startsWith(">")) {
      break;
    }
    quoteLines.push(line.replace(/^>\s?/, ""));
    index += 1;
  }
  return {
    blocks: [
      {
        object: "block",
        type: "quote",
        quote: { rich_text: richTextFromMarkdown(quoteLines.join("\n")) },
      },
    ],
    nextIndex: index,
  };
}

/** Parses a math equation block. */
export function parseEquation(lines: string[], startIndex: number): ParseResult {
  const firstLine = lines[startIndex]?.trim() ?? "";
  if (firstLine.endsWith("$$") && firstLine.length > 4) {
    return {
      blocks: [
        {
          object: "block",
          type: "equation",
          equation: { expression: firstLine.slice(2, -2).trim() },
        },
      ],
      nextIndex: startIndex + 1,
    };
  }

  const body: string[] = [];
  let index = startIndex + 1;
  while (index < lines.length && (lines[index]?.trim() ?? "") !== "$$") {
    body.push(lines[index] ?? "");
    index += 1;
  }

  return {
    blocks: [
      {
        object: "block",
        type: "equation",
        equation: { expression: body.join("\n").trim() },
      },
    ],
    nextIndex: Math.min(index + 1, lines.length),
  };
}

/** Parses media, embed, bookmark, and child object shortcuts. */
export function parseMediaBlock(line: string): NotionBlock | null {
  const imageMatch = /^!\[(.*)\]\((.+)\)\s*$/.exec(line.trim());
  if (imageMatch !== null) {
    return {
      object: "block",
      type: "image",
      image: {
        type: "external",
        external: { url: imageMatch[2] },
        caption:
          imageMatch[1].length > 0 ? richTextFromMarkdown(imageMatch[1]) : undefined,
      },
    };
  }

  const taggedMedia =
    /^<(file|video|audio|pdf|embed|bookmark)\s+src="([^"]+)"(?:\s+caption="([^"]*)")?\s*\/?>$/i.exec(
      line.trim()
    );
  if (taggedMedia !== null) {
    const captionText = taggedMedia.at(3) ?? "";
    const caption =
      captionText.length > 0 ? richTextFromMarkdown(captionText) : undefined;
    switch (taggedMedia[1].toLowerCase()) {
      case "file":
        return {
          object: "block",
          type: "file",
          file: { type: "external", external: { url: taggedMedia[2] }, caption },
        };
      case "video":
        return {
          object: "block",
          type: "video",
          video: { type: "external", external: { url: taggedMedia[2] }, caption },
        };
      case "audio":
        return {
          object: "block",
          type: "audio",
          audio: { type: "external", external: { url: taggedMedia[2] }, caption },
        };
      case "pdf":
        return {
          object: "block",
          type: "pdf",
          pdf: { type: "external", external: { url: taggedMedia[2] }, caption },
        };
      case "embed":
        return {
          object: "block",
          type: "embed",
          embed: { url: taggedMedia[2], caption },
        };
      default:
        return {
          object: "block",
          type: "bookmark",
          bookmark: { url: taggedMedia[2], caption },
        };
    }
  }

  const childPage = /^<page\s+title="([^"]+)"(?:\s+url="([^"]+)")?\s*\/>$/.exec(
    line.trim()
  );
  if (childPage !== null) {
    return {
      object: "block",
      type: "child_page",
      child_page: {
        title: childPage[1],
        url: childPage[2],
      },
    };
  }

  const childDatabase =
    /^<database\s+title="([^"]+)"(?:\s+url="([^"]+)")?\s*\/>$/.exec(line.trim());
  if (childDatabase !== null) {
    return {
      object: "block",
      type: "child_database",
      child_database: {
        title: childDatabase[1],
        url: childDatabase[2],
      },
    };
  }

  return null;
}

/** Attaches recursively parsed child blocks to the given container block. */
export function attachChildren(block: NotionBlock, children: NotionBlock[]): void {
  if (children.length === 0) {
    return;
  }
  switch (block.type) {
    case "paragraph":
      block.paragraph.children = [...(block.paragraph.children ?? []), ...children];
      break;
    case "bulleted_list_item":
      block.bulleted_list_item.children = [
        ...(block.bulleted_list_item.children ?? []),
        ...children,
      ];
      break;
    case "numbered_list_item":
      block.numbered_list_item.children = [
        ...(block.numbered_list_item.children ?? []),
        ...children,
      ];
      break;
    case "to_do":
      block.to_do.children = [...(block.to_do.children ?? []), ...children];
      break;
    case "toggle":
      block.toggle.children = [...(block.toggle.children ?? []), ...children];
      break;
    case "quote":
      block.quote.children = [...(block.quote.children ?? []), ...children];
      break;
    case "callout":
      block.callout.children = [...(block.callout.children ?? []), ...children];
      break;
    case "synced_block":
      block.synced_block.children = [...(block.synced_block.children ?? []), ...children];
      break;
    default:
      break;
  }
}

/** Parses nested list blocks. */
export function parseListBlock(
  lines: string[],
  startIndex: number,
  baseIndent: number
): ParseResult {
  const blocks: NotionBlock[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (BLANK_LINE.test(line)) {
      index += 1;
      continue;
    }
    const marker = parseListMarker(line);
    if (marker === null || marker.indent < baseIndent) {
      break;
    }
    if (marker.indent > baseIndent) {
      const previous = blocks.at(-1);
      if (previous === undefined) {
        break;
      }
      const nested = parseListBlock(lines, index, marker.indent);
      attachChildren(previous, nested.blocks);
      index = nested.nextIndex;
      continue;
    }

    const richText = richTextFromMarkdown(marker.text);
    let block: NotionBlock;
    switch (marker.type) {
      case "bulleted_list_item":
        block = {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: richText },
        } satisfies NotionBulletedListItemBlock;
        break;
      case "numbered_list_item":
        block = {
          object: "block",
          type: "numbered_list_item",
          numbered_list_item: { rich_text: richText },
        } satisfies NotionNumberedListItemBlock;
        break;
      default:
        block = {
          object: "block",
          type: "to_do",
          to_do: { rich_text: richText, checked: marker.checked ?? false },
        } satisfies NotionToDoBlock;
        break;
    }

    blocks.push(block);
    index += 1;
  }

  return { blocks, nextIndex: index };
}
