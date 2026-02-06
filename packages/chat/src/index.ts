// Types
export {
  type User,
  type DiscordConfig,
  type SlackConfig,
  type ChatConfig,
  type Platform,
  type ReactionEvent,
  type ReactionCallback,
  type MessageEvent,
  type MessageCallback,
  type MessageContent,
  type FileAttachment,
  type ThreadData,
  type DisconnectCallback,
  type ErrorCallback,
} from "./types";

// Core classes
export { ChatClient } from "./ChatClient";
export { Channel } from "./Channel";
export { Message } from "./Message";

// Platform implementations
export { DiscordChatClient } from "./discord";
export { SlackChatClient } from "./slack";

// Factory
import { type ChatClient } from "./ChatClient";
import { DiscordChatClient } from "./discord";
import { SlackChatClient } from "./slack";
import type { ChatConfig } from "./types";

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
    case "discord":
      return new DiscordChatClient(config);
    case "slack":
      return new SlackChatClient(config);
    default:
      throw new Error(
        `Unknown chat platform: ${(config as { type: string }).type}`
      );
  }
}
