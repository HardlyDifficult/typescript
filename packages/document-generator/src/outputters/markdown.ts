import type { Block } from "../types.js";

export function toMarkdown(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          return `# ${block.text}\n\n`;

        case "text":
          return `${block.content}\n\n`;

        case "list":
          return `${block.items.map((item) => `- ${item}`).join("\n")}\n\n`;

        case "divider":
          return `---\n\n`;

        case "context":
          return `*${block.text}*\n\n`;

        case "link":
          return `[${block.text}](${block.url})\n\n`;

        case "code":
          if (block.multiline) {
            return `\`\`\`\n${block.content}\n\`\`\`\n\n`;
          }
          return `\`${block.content}\`\n\n`;

        case "image": {
          const alt = block.alt ?? block.url;
          return `![${alt}](${block.url})\n\n`;
        }

        default:
          return "";
      }
    })
    .join("");
}
