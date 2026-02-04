import type { Block } from '@hardlydifficult/documentGenerator';
import { convertMarkdown } from '@hardlydifficult/documentGenerator';

/**
 * Slack Block Kit text object
 */
export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

/**
 * Slack Block Kit block
 */
export interface SlackBlock {
  type: string;
  text?: SlackTextObject;
  elements?: SlackTextObject[];
  image_url?: string;
  alt_text?: string;
}

/**
 * Chunks text into smaller pieces, splitting at newlines when possible
 * to preserve readability. Each chunk will be at most maxLen characters.
 */
function chunkText(text: string, maxLen = 2900): string[] {
  if (text.length <= maxLen) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    // Try to find a newline near the maxLen boundary
    const searchStart = Math.max(0, maxLen - 500); // Look back up to 500 chars
    const newlineIndex = remaining.lastIndexOf('\n', maxLen);

    if (newlineIndex > searchStart) {
      // Split at newline
      chunks.push(remaining.slice(0, newlineIndex));
      remaining = remaining.slice(newlineIndex + 1);
    } else {
      // No good newline found, split at maxLen
      chunks.push(remaining.slice(0, maxLen));
      remaining = remaining.slice(maxLen);
    }
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Converts Document blocks to Slack Block Kit format
 */
export function toSlackBlocks(blocks: Block[]): SlackBlock[] {
  const slackBlocks: SlackBlock[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'header': {
        slackBlocks.push({
          type: 'header',
          text: {
            type: 'plain_text',
            text: block.text,
          },
        });
        break;
      }

      case 'text': {
        // Convert markdown to Slack format
        const slackText = convertMarkdown(block.content, 'slack');
        
        // Chunk if necessary
        const chunks = chunkText(slackText);
        for (const chunk of chunks) {
          slackBlocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: chunk,
            },
          });
        }
        break;
      }

      case 'list': {
        // Convert list items to Slack markdown format
        const listText = block.items.map(item => `• ${item}`).join('\n');
        const slackText = convertMarkdown(listText, 'slack');
        
        // Chunk if necessary
        const chunks = chunkText(slackText);
        for (const chunk of chunks) {
          slackBlocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: chunk,
            },
          });
        }
        break;
      }

      case 'divider': {
        slackBlocks.push({
          type: 'divider',
        });
        break;
      }

      case 'context': {
        const slackText = convertMarkdown(block.text, 'slack');
        slackBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: slackText,
            },
          ],
        });
        break;
      }

      case 'link': {
        // Slack link format: <url|text>
        const slackText = convertMarkdown(block.text, 'slack');
        slackBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${block.url}|${slackText}>`,
          },
        });
        break;
      }

      case 'code': {
        // Format code block with backticks
        let codeText: string;
        if (block.multiline) {
          codeText = `\`\`\`\n${block.content}\n\`\`\``;
        } else {
          codeText = `\`${block.content}\``;
        }
        
        slackBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: codeText,
          },
        });
        break;
      }

      case 'image': {
        slackBlocks.push({
          type: 'image',
          image_url: block.url,
          alt_text: block.alt || 'image',
        });
        break;
      }

      default:
        // Unknown block type, skip
        break;
    }
  }

  return slackBlocks;
}
