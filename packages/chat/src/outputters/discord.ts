import type { Block } from '@hardlydifficult/documentGenerator';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  fields?: DiscordEmbedField[];
  image?: { url: string };
  footer?: { text: string };
}

export function toDiscordEmbed(blocks: Block[]): DiscordEmbed {
  const embed: DiscordEmbed = {};
  const descriptionParts: string[] = [];
  let titleSet = false;
  let footerSet = false;

  for (const block of blocks) {
    switch (block.type) {
      case 'header':
        if (!titleSet) {
          embed.title = block.text;
          titleSet = true;
        } else {
          // Subsequent headers go into description
          descriptionParts.push(`**${block.text}**`);
        }
        break;

      case 'text':
        descriptionParts.push(block.content);
        break;

      case 'list':
        const listItems = block.items.map(item => `• ${item}`).join('\n');
        descriptionParts.push(listItems);
        break;

      case 'divider':
        descriptionParts.push('───────────');
        break;

      case 'context':
        if (!footerSet) {
          embed.footer = { text: block.text };
          footerSet = true;
        } else if (embed.footer) {
          // If footer already set, append to existing footer
          embed.footer = { text: `${embed.footer.text} | ${block.text}` };
        }
        break;

      case 'link':
        descriptionParts.push(`[${block.text}](${block.url})`);
        break;

      case 'code':
        if (block.multiline) {
          descriptionParts.push(`\`\`\`\n${block.content}\n\`\`\``);
        } else {
          descriptionParts.push(`\`${block.content}\``);
        }
        break;

      case 'image':
        embed.image = { url: block.url };
        break;
    }
  }

  // Join description parts with double newlines for spacing
  if (descriptionParts.length > 0) {
    embed.description = descriptionParts.join('\n\n');
  }

  return embed;
}
