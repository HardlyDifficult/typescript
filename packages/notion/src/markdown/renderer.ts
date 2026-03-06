import type { NotionBlock } from "../types.js";

import { renderRichText, richTextToPlainText } from "./richText.js";
import { INDENT_WIDTH } from "./shared.js";

function renderChildren(children: NotionBlock[] | undefined, depth: number): string {
  if (children === undefined || children.length === 0) {
    return "";
  }
  return `\n${blocksToMarkdown(children, depth)}`;
}

function renderBlock(block: NotionBlock, depth: number): string {
  const indent = " ".repeat(depth * INDENT_WIDTH);

  switch (block.type) {
    case "paragraph":
      return `${indent}${renderRichText(block.paragraph.rich_text)}${renderChildren(
        block.paragraph.children,
        depth + 1
      )}`;
    case "heading_1":
      return `${indent}# ${renderRichText(block.heading_1.rich_text)}`;
    case "heading_2":
      return `${indent}## ${renderRichText(block.heading_2.rich_text)}`;
    case "heading_3":
      return `${indent}### ${renderRichText(block.heading_3.rich_text)}`;
    case "bulleted_list_item":
      return `${indent}- ${renderRichText(
        block.bulleted_list_item.rich_text
      )}${renderChildren(block.bulleted_list_item.children, depth + 1)}`;
    case "numbered_list_item":
      return `${indent}1. ${renderRichText(
        block.numbered_list_item.rich_text
      )}${renderChildren(block.numbered_list_item.children, depth + 1)}`;
    case "to_do":
      return `${indent}- [${block.to_do.checked ? "x" : " "}] ${renderRichText(
        block.to_do.rich_text
      )}${renderChildren(block.to_do.children, depth + 1)}`;
    case "toggle":
      return `${indent}<details>\n${indent}<summary>${renderRichText(
        block.toggle.rich_text
      )}</summary>\n\n${blocksToMarkdown(block.toggle.children ?? [], depth + 1)}\n${indent}</details>`;
    case "quote":
      return renderRichText(block.quote.rich_text)
        .split("\n")
        .map((line) => `${indent}> ${line}`)
        .join("\n");
    case "callout": {
      const calloutChildren = block.callout.children ?? [];
      const icon =
        block.callout.icon?.type === "emoji" ? ` [icon=${block.callout.icon.emoji}]` : "";
      const color = block.callout.color !== undefined ? ` {color="${block.callout.color}"}` : "";
      const firstLine = renderRichText(block.callout.rich_text);
      const nested = calloutChildren.length > 0
        ? `\n${blocksToMarkdown(calloutChildren, depth + 1)}`
        : "";
      return `${indent}::: callout${icon}${color}\n${indent}${firstLine}${nested}\n${indent}:::`;
    }
    case "divider":
      return `${indent}---`;
    case "code":
      return `${indent}\`\`\`${block.code.language ?? ""}\n${richTextToPlainText(
        block.code.rich_text
      )}\n${indent}\`\`\``;
    case "equation":
      return `${indent}$$ ${block.equation.expression} $$`;
    case "image":
      return `${indent}![${renderRichText(block.image.caption ?? [])}](${
        block.image.type === "external" ? block.image.external.url : block.image.file.url
      })`;
    case "file":
      return `${indent}<file src="${
        block.file.type === "external" ? block.file.external.url : block.file.file.url
      }"${
        block.file.caption !== undefined
          ? ` caption="${renderRichText(block.file.caption)}"`
          : ""
      } />`;
    case "video":
      return `${indent}<video src="${
        block.video.type === "external" ? block.video.external.url : block.video.file.url
      }"${
        block.video.caption !== undefined
          ? ` caption="${renderRichText(block.video.caption)}"`
          : ""
      } />`;
    case "audio":
      return `${indent}<audio src="${
        block.audio.type === "external" ? block.audio.external.url : block.audio.file.url
      }"${
        block.audio.caption !== undefined
          ? ` caption="${renderRichText(block.audio.caption)}"`
          : ""
      } />`;
    case "pdf":
      return `${indent}<pdf src="${
        block.pdf.type === "external" ? block.pdf.external.url : block.pdf.file.url
      }"${
        block.pdf.caption !== undefined
          ? ` caption="${renderRichText(block.pdf.caption)}"`
          : ""
      } />`;
    case "bookmark":
      return `${indent}<bookmark src="${block.bookmark.url}"${
        block.bookmark.caption !== undefined
          ? ` caption="${renderRichText(block.bookmark.caption)}"`
          : ""
      } />`;
    case "embed":
      return `${indent}<embed src="${block.embed.url}"${
        block.embed.caption !== undefined
          ? ` caption="${renderRichText(block.embed.caption)}"`
          : ""
      } />`;
    case "child_page":
      return `${indent}<page title="${block.child_page.title}"${
        block.child_page.url !== undefined ? ` url="${block.child_page.url}"` : ""
      } />`;
    case "child_database":
      return `${indent}<database title="${block.child_database.title}"${
        block.child_database.url !== undefined
          ? ` url="${block.child_database.url}"`
          : ""
      } />`;
    case "synced_block":
      return `${indent}<synced_block>\n${blocksToMarkdown(
        block.synced_block.children ?? [],
        depth + 1
      )}\n${indent}</synced_block>`;
    case "table_of_contents":
      return `${indent}<table_of_contents/>`;
    default:
      return `${indent}<unsupported-block type="${
        block.original_type ?? block.type
      }" />`;
  }
}

/** Converts supported Notion blocks into markdown. */
export function blocksToMarkdown(blocks: NotionBlock[], depth = 0): string {
  return blocks
    .map((block) => renderBlock(block, depth))
    .filter((block) => block.length > 0)
    .join("\n\n")
    .trim();
}
