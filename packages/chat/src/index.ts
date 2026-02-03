// Types
export {
  User,
  type DiscordConfig,
  type SlackConfig,
  type ChatConfig,
  type Platform,
  type ReactionEvent,
  type ReactionCallback,
  type PostMessageOptions,
  type ConnectionState,
} from './types.js';

// Core classes
export { ChatClient } from './ChatClient.js';
export { Channel } from './Channel.js';
export { Message } from './Message.js';

// Platform implementations
export { DiscordChatClient } from './discord/index.js';
export { SlackChatClient } from './slack/index.js';

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
 * // Discord
 * const client = createChatClient({
 *   type: 'discord',
 *   token: process.env.DISCORD_TOKEN!,
 *   guildId: process.env.DISCORD_GUILD_ID!,
 * });
 *
 * // Slack
 * const client = createChatClient({
 *   type: 'slack',
 *   token: process.env.SLACK_BOT_TOKEN!,
 *   appToken: process.env.SLACK_APP_TOKEN!,
 * });
 *
 * // Usage
 * const channel = await client.connect(channelId);
 * await channel.postMessage('Vote: 1, 2, or 3').addReactions(['1️⃣', '2️⃣', '3️⃣']);
 *
 * channel.onReaction((event) => {
 *   console.log(`${event.user} voted ${event.emoji}`);
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
