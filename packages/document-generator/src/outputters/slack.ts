import { convertMarkdown } from "../markdownConverter.js";
import type { Block } from "../types.js";

/** Renders an array of Document blocks as a Slack mrkdwn-compatible string. */
export function toSlackText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          return `*${block.text}*\n\n`;

        case "text":
          return `${convertMarkdown(block.content, "slack")}\n\n`;

        case "list":
          return `${block.items
            .map((item) => `• ${convertMarkdown(item, "slack")}`)
            .join("\n")}\n\n`;

        case "divider":
          return `────────────────\n\n`;

        case "context":
          return `${convertMarkdown(block.text, "slack")}\n\n`;

        case "link": {
          const text = convertMarkdown(block.text, "slack");
          return `<${block.url}|${text}>\n\n`;
        }

        case "code":
          if (block.multiline) {
            return `\`\`\`\n${block.content}\n\`\`\`\n\n`;
          }
          return `\`${block.content}\`\n\n`;

        case "image": {
          const alt = convertMarkdown(block.alt ?? block.url, "slack");
          return `Image: <${block.url}|${alt}>\n\n`;
        }

        default:
          return "";
      }
    })
    .join("");
}

/** Alias for `toSlackText()` to keep method naming concise in clients. */
export const toSlack = toSlackText;
