import type {
  NotionBlock,
  NotionBulletedListItemBlock,
  NotionColor,
  NotionDividerBlock,
  NotionHeading1Block,
  NotionHeading2Block,
  NotionHeading3Block,
  NotionNumberedListItemBlock,
  NotionSyncedBlock,
  NotionTableOfContentsBlock,
  NotionToDoBlock,
} from "../types.js";
import { BLANK_LINE, normalizeMarkdown } from "./shared.js";
import { makeTextRichText, richTextFromMarkdown } from "./richText.js";

interface ParseResult {
  blocks: NotionBlock[];
  nextIndex: number;
}

interface ListMarker {
  indent: number;
  type: "bulleted_list_item" | "numbered_list_item" | "to_do";
  text: string;
  checked?: boolean;
}

function parseHeading(
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

function parseListMarker(line: string): ListMarker | null {
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

function parseParagraph(lines: string[], startIndex: number): ParseResult {
  const collected: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (
      BLANK_LINE.test(line) ||
      parseHeading(line) !== null ||
      parseListMarker(line) !== null ||
      /^```/.test(line.trim()) ||
      /^>/.test(line.trim()) ||
      /^---+$/.test(line.trim()) ||
      /^<details>\s*$/.test(line.trim()) ||
      /^:::\s*callout/.test(line.trim()) ||
      /^<table_of_contents\s*\/>\s*$/.test(line.trim()) ||
      /^<(file|video|audio|pdf|embed|bookmark)\b/.test(line.trim()) ||
      /^!\[.*\]\(.*\)\s*$/.test(line.trim()) ||
      /^<(page|database)\b/.test(line.trim()) ||
      /^\$\$/.test(line.trim())
    ) {
      break;
    }
    collected.push(line.trim());
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

function parseCodeFence(lines: string[], startIndex: number): ParseResult {
  const opening = lines[startIndex]?.trim() ?? "";
  const language = opening.replace(/^```/, "").trim();
  const body: string[] = [];
  let index = startIndex + 1;

  while (index < lines.length && !/^```/.test(lines[index]?.trim() ?? "")) {
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

function parseQuote(lines: string[], startIndex: number): ParseResult {
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

function parseDetails(lines: string[], startIndex: number): ParseResult {
  let index = startIndex + 1;
  let summary = "Details";

  const summaryLine = lines[index]?.trim() ?? "";
  const summaryMatch = /^<summary>(.*)<\/summary>$/.exec(summaryLine);
  if (summaryMatch !== null) {
    summary = summaryMatch[1];
    index += 1;
  }

  const body: string[] = [];
  while (index < lines.length && (lines[index]?.trim() ?? "") !== "</details>") {
    body.push(lines[index] ?? "");
    index += 1;
  }

  return {
    blocks: [
      {
        object: "block",
        type: "toggle",
        toggle: {
          rich_text: richTextFromMarkdown(summary),
          children: markdownToBlocks(body.join("\n")),
        },
      },
    ],
    nextIndex: Math.min(index + 1, lines.length),
  };
}

function parseCallout(lines: string[], startIndex: number): ParseResult {
  const opening = lines[startIndex]?.trim() ?? "";
  const iconMatch = /\[icon=(.+?)\]/.exec(opening);
  const colorMatch = /color="([^"]+)"/.exec(opening);
  const color = colorMatch?.[1] as NotionColor | undefined;
  let index = startIndex + 1;
  const body: string[] = [];

  while (index < lines.length && (lines[index]?.trim() ?? "") !== ":::") {
    body.push(lines[index] ?? "");
    index += 1;
  }

  const children = markdownToBlocks(body.join("\n"));
  const [first, ...rest] = children;
  const richText =
    first !== undefined && first.type === "paragraph"
      ? first.paragraph.rich_text
      : [];
  const nestedChildren =
    first !== undefined && first.type === "paragraph" ? rest : children;

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
    nextIndex: Math.min(index + 1, lines.length),
  };
}

function parseEquation(lines: string[], startIndex: number): ParseResult {
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

function parseMediaBlock(line: string): NotionBlock | null {
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
    const caption =
      taggedMedia[3] !== undefined && taggedMedia[3].length > 0
        ? richTextFromMarkdown(taggedMedia[3])
        : undefined;
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

function attachChildren(block: NotionBlock, children: NotionBlock[]): void {
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

function parseListBlock(
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
    const block =
      marker.type === "bulleted_list_item"
        ? ({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: { rich_text: richText },
          } satisfies NotionBulletedListItemBlock)
        : marker.type === "numbered_list_item"
          ? ({
              object: "block",
              type: "numbered_list_item",
              numbered_list_item: { rich_text: richText },
            } satisfies NotionNumberedListItemBlock)
          : ({
              object: "block",
              type: "to_do",
              to_do: { rich_text: richText, checked: marker.checked ?? false },
            } satisfies NotionToDoBlock);

    blocks.push(block);
    index += 1;
  }

  return { blocks, nextIndex: index };
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

    if (/^```/.test(trimmed)) {
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
      const inner: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        (lines[index]?.trim() ?? "") !== "</synced_block>"
      ) {
        inner.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({
        object: "block",
        type: "synced_block",
        synced_block: { children: markdownToBlocks(inner.join("\n")) },
      } satisfies NotionSyncedBlock);
      index = Math.min(index + 1, lines.length);
      continue;
    }

    if (/^\$\$/.test(trimmed)) {
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
      } satisfies NotionDividerBlock);
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

export function markdownToBlocks(markdown: string): NotionBlock[] {
  const normalized = normalizeMarkdown(markdown);
  if (normalized.length === 0) {
    return [];
  }
  return parseBlocks(normalized.split("\n")).blocks;
}
