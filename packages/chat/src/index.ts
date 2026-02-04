// Types
export {
  type User,
  type DiscordConfig,
  type SlackConfig,
  type ChatConfig,
  type Platform,
  type ReactionEvent,
  type ReactionCallback,
  type MessageContent,
  type PostMessageOptions,
  type Document,
} from './types.js';

// Core classes
export { ChatClient } from './ChatClient.js';
export { Channel, type ChannelOperations } from './Channel.js';
export { Message, ReplyMessage, type MessageOperations } from './Message.js';

// Platform implementations
export { DiscordChatClient } from './discord/index.js';
export { SlackChatClient } from './slack/index.js';

// Outputters (for direct use if needed)
export { toSlackBlocks, type SlackBlock, type SlackTextObject } from './outputters/slack.js';
export { toDiscordEmbed, type DiscordEmbed, type DiscordEmbedField } from './outputters/discord.js';

// Factory
import type { ChatConfig } from './types.js';
import { ChatClient } from './ChatClient.js';
import { DiscordChatClient } from './discord/index.js';
import { SlackChatClient } from './slack/index.js';

/**
 * Factory function to create a chat client based on config type
 *
 * @example
 * ```typescript
 * // Discord (uses env vars by default)
 * const client = createChatClient({ type: 'discord' });
 *
 * // Slack (uses env vars by default)
 * const client = createChatClient({ type: 'slack' });
 *
 * // Usage
 * const channel = await client.connect(channelId);
 * await channel.postMessage('Vote: 1, 2, or 3').addReactions(['1️⃣', '2️⃣', '3️⃣']);
 *
 * channel.onReaction((event) => {
 *   console.log(`${event.user.username ?? event.user.id} voted ${event.emoji}`);
 * });
 * ```
 */
export function createChatClient(config: ChatConfig): ChatClient {
  switch (config.type) {
    case 'discord':
      return new DiscordChatClient(config);
    case 'slack':
      return new SlackChatClient(config);
    default:
      throw new Error(`Unknown chat platform: ${(config as { type: string }).type}`);
  }
}
