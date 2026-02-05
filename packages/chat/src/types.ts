import { Document } from '@hardlydifficult/document-generator';

// Re-export Document and related types from document-generator
export {
  Document,
  doc,
  type DocumentOptions,
  type DocumentSection,
  type KeyValueOptions,
  type TruncatedListOptions,
  type TimestampOptions,
} from '@hardlydifficult/document-generator';

/**
 * Configuration for Discord client
 */
export interface DiscordConfig {
  type: 'discord';
  token?: string; // defaults to process.env.DISCORD_TOKEN
  guildId?: string; // defaults to process.env.DISCORD_GUILD_ID
}

/**
 * Configuration for Slack client
 */
export interface SlackConfig {
  type: 'slack';
  token?: string; // defaults to process.env.SLACK_BOT_TOKEN
  appToken?: string; // defaults to process.env.SLACK_APP_TOKEN
  socketMode?: boolean;
}

export type ChatConfig = DiscordConfig | SlackConfig;

/**
 * Platform identifier
 */
export type Platform = 'discord' | 'slack';

/**
 * User who performed an action (e.g., added a reaction)
 */
export interface User {
  id: string;
  username?: string;
}

/**
 * Data provided to reaction callbacks
 */
export interface ReactionEvent {
  /** The emoji that was added */
  emoji: string;
  /** User who added the reaction */
  user: User;
  /** ID of the message that received the reaction */
  messageId: string;
  /** ID of the channel containing the message */
  channelId: string;
  /** Timestamp of the reaction */
  timestamp: Date;
}

/**
 * Callback function type for reaction events
 */
export type ReactionCallback = (event: ReactionEvent) => void | Promise<void>;

/**
 * Internal message data passed between classes
 */
export interface MessageData {
  id: string;
  channelId: string;
  platform: Platform;
}

/**
 * Message content can be string or Document
 */
export type MessageContent = string | Document;

/**
 * Options for posting messages with thread support
 */
export interface PostMessageOptions {
  threadTs?: string;
}
