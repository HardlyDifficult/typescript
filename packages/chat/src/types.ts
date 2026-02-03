/**
 * Configuration for Discord client
 */
export interface DiscordConfig {
  type: 'discord';
  token: string;
  guildId: string;
}

/**
 * Configuration for Slack client
 */
export interface SlackConfig {
  type: 'slack';
  token: string;
  appToken: string;
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
export class User {
  constructor(
    public readonly id: string,
    public readonly username: string | undefined,
  ) {}

  toString(): string {
    return this.username ?? this.id;
  }
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
 * Options for posting a message
 */
export interface PostMessageOptions {
  threadId?: string;
}

/**
 * Connection state of the client
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Internal message data passed between classes
 */
export interface MessageData {
  id: string;
  channelId: string;
  platform: Platform;
}
