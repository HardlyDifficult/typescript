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
  // Document and related types (from document-generator)
  Document,
  doc,
  type DocumentOptions,
  type DocumentSection,
  type KeyValueOptions,
  type TruncatedListOptions,
  type TimestampOptions,
} from './types';

// Core classes
export { ChatClient } from './ChatClient';
export { Channel, type ChannelOperations } from './Channel';
export { Message, ReplyMessage, type MessageOperations } from './Message';

// Platform implementations
export { DiscordChatClient } from './discord/index';
export { SlackChatClient } from './slack/index';

// Factory
import type { ChatConfig } from './types';
import { ChatClient } from './ChatClient';
import { DiscordChatClient } from './discord/index';
import { SlackChatClient } from './slack/index';

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
