import type { Document } from "@hardlydifficult/document-generator";

/**
 * Configuration for Discord client
 */
export interface DiscordConfig {
  type: "discord";
  token?: string; // defaults to process.env.DISCORD_TOKEN
  guildId?: string; // defaults to process.env.DISCORD_GUILD_ID
}

/**
 * Configuration for Slack client
 */
export interface SlackConfig {
  type: "slack";
  token?: string; // defaults to process.env.SLACK_BOT_TOKEN
  appToken?: string; // defaults to process.env.SLACK_APP_TOKEN
  socketMode?: boolean;
}

export type ChatConfig = DiscordConfig | SlackConfig;

/**
 * Platform identifier
 */
export type Platform = "discord" | "slack";

/**
 * User who performed an action (e.g., added a reaction)
 */
export interface User {
  id: string;
  username?: string;
}

/**
 * Identity of the authenticated bot/client user.
 */
export interface ClientIdentity extends User {
  /** Display name shown in the platform UI */
  displayName: string;
  /** Ready-to-use mention string (e.g., "<@USER_ID>") */
  mention: string;
}

/**
 * A member of a channel with mention support
 */
export interface Member {
  /** Platform-specific user ID */
  id: string;
  /** Username (e.g., "johndoe") */
  username: string;
  /** Display name shown in the UI (nickname, real name, or username fallback) */
  displayName: string;
  /** Ready-to-use mention string (e.g., "<@USER_ID>") — embed in messages to @mention */
  mention: string;
  /** Optional email address (platform-dependent; not always available) */
  email?: string;
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
 * An attachment on an incoming message
 */
export interface Attachment {
  /** URL to download the attachment */
  url: string;
  /** Filename including extension */
  name: string;
  /** MIME type of the attachment */
  contentType?: string;
  /** File size in bytes */
  size?: number;
}

/**
 * Data provided to incoming message callbacks
 */
export interface MessageEvent {
  /** ID of the message */
  id: string;
  /** Text content of the message */
  content: string;
  /** User who sent the message */
  author: User;
  /** ID of the channel the message was posted in */
  channelId: string;
  /** Timestamp of the message */
  timestamp: Date;
  /** File attachments on the message */
  attachments: Attachment[];
  /** Thread identifier (present only for thread messages, used internally for routing) */
  threadId?: string;
}

/**
 * Callback function type for incoming message events
 */
export type MessageCallback = (event: MessageEvent) => void | Promise<void>;

/**
 * File attachment for message posting
 */
export interface FileAttachment {
  /** File content as a Buffer or string */
  content: Buffer | string;
  /** Filename including extension */
  name: string;
}

/**
 * Data returned when a thread is created
 */
export interface ThreadData {
  /** ID of the created thread */
  id: string;
  /** ID of the parent channel */
  channelId: string;
  /** Platform identifier */
  platform: Platform;
}

/**
 * Connection event types for resilience callbacks
 */
export type DisconnectCallback = (reason: string) => void | Promise<void>;
export type ErrorCallback = (error: Error) => void | Promise<void>;

/**
 * Internal message data passed between classes
 */
export interface MessageData {
  id: string;
  channelId: string;
  platform: Platform;
  content?: string;
  author?: User;
  timestamp?: Date;
  attachments?: Attachment[];
}

/**
 * Message content can be string or Document
 */
export type MessageContent = string | Document;

/** Timestamp input accepted by message query filters. */
export type TimestampInput = string | number | Date;

/**
 * Options for deleting a message.
 */
export interface DeleteMessageOptions {
  /**
   * Whether to delete thread replies before deleting the parent message.
   * Defaults to true.
   */
  cascadeReplies?: boolean;
}

/** Author filter for message listing. */
export type MessageAuthorFilter = string;

/**
 * Query options for listing channel messages.
 */
export interface MessageQueryOptions {
  /** Maximum number of recent messages to fetch (platform limits apply) */
  limit?: number;
  /** Filter by author: "me" (the connected bot) or a user identifier/query */
  author?: MessageAuthorFilter;
  /** Only include messages after this timestamp */
  after?: TimestampInput;
  /** Only include messages before this timestamp */
  before?: TimestampInput;
}
