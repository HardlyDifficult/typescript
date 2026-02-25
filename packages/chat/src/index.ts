// Types
export {
  type Attachment,
  type ClientIdentity,
  type User,
  type Member,
  type DiscordConfig,
  type SlackConfig,
  type ChatConfig,
  type Platform,
  type ReactionEvent,
  type ReactionCallback,
  type MessageEvent,
  type MessageContent,
  type MessageAuthorFilter,
  type MessageQueryOptions,
  type BatchMessageRef,
  type BeginBatchOptions,
  type BatchQueryOptions,
  type BatchDeleteSummary,
  type BatchKeepLatestSummary,
  type FileAttachment,
  type DeleteMessageOptions,
  type TimestampInput,
  type ThreadData,
  type DisconnectCallback,
  type ErrorCallback,
} from "./types.js";

// Constants
export { MESSAGE_LIMITS } from "./constants.js";

// Core classes
export { ChatClient } from "./ChatClient.js";
export { Channel } from "./Channel.js";
export { Message } from "./Message.js";
export { MessageBatch } from "./MessageBatch.js";
export { EditableStreamReply } from "./EditableStreamReply.js";
export { StreamingReply } from "./StreamingReply.js";
export { Thread } from "./Thread.js";
export { createMessageTracker, type MessageTracker } from "./MessageTracker.js";

// Platform implementations
export { DiscordChatClient } from "./discord";
export { SlackChatClient } from "./slack";

// Commands
export {
  type Command,
  type CommandContext,
  type ArgShape,
  type ParseResult,
  type Agent,
  type CoreBotState,
  CommandRegistry,
  type RegisteredCommand,
  CommandDispatcher,
  type DispatcherOptions,
  setupJobLifecycle,
  type JobLifecycleOptions,
  type JobLifecycleHandle,
  EMOJI_CANCEL,
  EMOJI_DISMISS,
  formatWorkerError,
  RECOVERABLE_WORKER_ERRORS,
} from "./commands";

// Utilities
export { findBestMemberMatch, extractMentionId } from "./memberMatching.js";
export { toDiscordEmbed, toSlackBlocks } from "./outputters";

// Factory
import { type ChatClient } from "./ChatClient.js";
import { DiscordChatClient } from "./discord";
import { SlackChatClient } from "./slack";
import type { ChatConfig } from "./types.js";

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
