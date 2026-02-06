import {
  AttachmentBuilder,
  Client,
  type Message as DiscordMessage,
  type User as DiscordUser,
  GatewayIntentBits,
  type MessageReaction,
  type PartialMessage,
  type PartialMessageReaction,
  type PartialUser,
  TextChannel,
} from "discord.js";

import { Channel, type ChannelOperations } from "../Channel.js";
import { ChatClient } from "../ChatClient.js";
import { type DiscordEmbed, toDiscordEmbed } from "../outputters/discord.js";
import type {
  DisconnectCallback,
  DiscordConfig,
  ErrorCallback,
  FileAttachment,
  MessageCallback,
  MessageContent,
  MessageData,
  MessageEvent,
  ReactionCallback,
  ReactionEvent,
  StartThreadOptions,
  ThreadData,
  User,
} from "../types.js";
import { isDocument } from "../utils.js";

/**
 * Discord chat client implementation using discord.js
 */
export class DiscordChatClient extends ChatClient implements ChannelOperations {
  private client: Client;
  private reactionListeners = new Map<string, Set<ReactionCallback>>();
  private messageListeners = new Map<string, Set<MessageCallback>>();
  private disconnectCallbacks = new Set<DisconnectCallback>();
  private errorCallbacks = new Set<ErrorCallback>();
  private readonly token: string;
  private readonly guildId: string;

  constructor(config: DiscordConfig) {
    super(config);
    this.token = config.token ?? process.env.DISCORD_TOKEN ?? "";
    this.guildId = config.guildId ?? process.env.DISCORD_GUILD_ID ?? "";

    const intents = [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      // MessageContent is a privileged intent requiring Discord developer portal approval.
      // Enabled by default; set config.intents.messageContent = false to disable.
      ...(config.intents?.messageContent === false
        ? []
        : [GatewayIntentBits.MessageContent]),
    ];

    this.client = new Client({ intents });

    this.setupReactionListener();
    this.setupMessageListener();
    this.setupConnectionResilience();
  }

  /**
   * Set up the global reaction listener that routes events to channel-specific callbacks
   */
  private setupReactionListener(): void {
    this.client.on(
      "messageReactionAdd",
      (
        reaction: MessageReaction | PartialMessageReaction,
        user: DiscordUser | PartialUser
      ): void => {
        void (async (): Promise<void> => {
          // Handle partial reactions
          if (reaction.partial) {
            try {
              await reaction.fetch();
            } catch (error) {
              console.error("Failed to fetch partial reaction:", error);
              return;
            }
          }

          const { channelId } = reaction.message;
          const callbacks = this.reactionListeners.get(channelId);

          if (!callbacks || callbacks.size === 0) {
            return;
          }

          const reactionUser: User = {
            id: user.id,
            username: user.username ?? undefined,
          };

          const event: ReactionEvent = {
            emoji: reaction.emoji.name ?? reaction.emoji.id ?? "",
            user: reactionUser,
            messageId: reaction.message.id,
            channelId,
            timestamp: new Date(),
          };

          for (const callback of callbacks) {
            try {
              await callback(event);
            } catch (error) {
              console.error("Reaction callback error:", error);
            }
          }
        })();
      }
    );
  }

  /**
   * Set up the global message listener that routes events to channel-specific callbacks
   */
  private setupMessageListener(): void {
    this.client.on(
      "messageCreate",
      (message: DiscordMessage | PartialMessage): void => {
        void (async (): Promise<void> => {
          // Ignore messages from the bot itself
          if (message.author?.id === this.client.user?.id) {
            return;
          }

          const { channelId } = message;
          const callbacks = this.messageListeners.get(channelId);

          if (!callbacks || callbacks.size === 0) {
            return;
          }

          const author: User = {
            id: message.author?.id ?? "",
            username: message.author?.username ?? undefined,
          };

          const event: MessageEvent = {
            id: message.id,
            content: message.content ?? "",
            author,
            channelId,
            timestamp: message.createdAt,
          };

          for (const callback of callbacks) {
            try {
              await callback(event);
            } catch (error) {
              console.error("Message callback error:", error);
            }
          }
        })();
      }
    );
  }

  /**
   * Set up connection event forwarding.
   * discord.js handles reconnection internally — these callbacks are for observability.
   */
  private setupConnectionResilience(): void {
    this.client.on("shardDisconnect", (_event, shardId) => {
      const reason = `Shard ${String(shardId)} disconnected`;
      for (const callback of this.disconnectCallbacks) {
        void Promise.resolve(callback(reason)).catch((err: unknown) => {
          console.error("Disconnect callback error:", err);
        });
      }
    });

    this.client.on("shardError", (error, shardId) => {
      const wrappedError =
        error instanceof Error
          ? error
          : new Error(`Shard ${String(shardId)} error: ${String(error)}`);
      for (const callback of this.errorCallbacks) {
        void Promise.resolve(callback(wrappedError)).catch((err: unknown) => {
          console.error("Error callback error:", err);
        });
      }
    });
  }

  /**
   * Connect to Discord and return a channel object
   * @param channelId - Discord channel ID
   * @returns Channel object for interacting with the channel
   */
  async connect(channelId: string): Promise<Channel> {
    await this.client.login(this.token);

    const discordChannel = await this.client.channels.fetch(channelId);

    if (!discordChannel || !(discordChannel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }

    return new Channel(channelId, "discord", this);
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    this.reactionListeners.clear();
    this.messageListeners.clear();
    this.disconnectCallbacks.clear();
    this.errorCallbacks.clear();
    await this.client.destroy();
  }

  /**
   * Post a message to a Discord channel
   * @param channelId - Channel to post to
   * @param content - Message content (string or Document)
   * @param options - Optional options including threadTs for replies
   * @returns Message data with ID
   */
  async postMessage(
    channelId: string,
    content: MessageContent,
    options?: { threadTs?: string; files?: FileAttachment[] }
  ): Promise<MessageData> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }

    let messageOptions: {
      content?: string;
      embeds?: DiscordEmbed[];
      messageReference?: { messageId: string };
      files?: AttachmentBuilder[];
    };

    if (isDocument(content)) {
      const embed = toDiscordEmbed(content.getBlocks());
      // Check if embed has any content - Discord rejects empty embeds
      const hasEmbedContent =
        embed.title !== undefined ||
        embed.description !== undefined ||
        embed.footer !== undefined ||
        embed.image !== undefined;

      if (hasEmbedContent) {
        messageOptions = { embeds: [embed] };
      } else {
        // Fallback to empty content for documents with no visible blocks
        messageOptions = { content: "\u200B" };
      }
    } else {
      messageOptions = { content };
    }

    // If threadTs is provided (non-empty), use it as a reply reference
    if (options?.threadTs !== undefined && options.threadTs !== "") {
      messageOptions.messageReference = { messageId: options.threadTs };
    }

    // Add file attachments
    if (options?.files && options.files.length > 0) {
      messageOptions.files = options.files.map(
        (file) =>
          new AttachmentBuilder(
            typeof file.content === "string"
              ? Buffer.from(file.content)
              : file.content,
            { name: file.name }
          )
      );
    }

    const message = await channel.send(messageOptions);

    return {
      id: message.id,
      channelId,
      platform: "discord",
    };
  }

  /**
   * Update a message in a Discord channel
   * @param messageId - ID of the message to update
   * @param channelId - Channel containing the message
   * @param content - New message content (string or Document)
   */
  async updateMessage(
    messageId: string,
    channelId: string,
    content: MessageContent
  ): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }

    const message = await channel.messages.fetch(messageId);

    if (isDocument(content)) {
      const embed = toDiscordEmbed(content.getBlocks());
      await message.edit({ embeds: [embed] });
    } else {
      // Clear embeds when switching to text
      await message.edit({ content, embeds: [] });
    }
  }

  /**
   * Delete a message from a Discord channel
   * @param messageId - ID of the message to delete
   * @param channelId - Channel containing the message
   */
  async deleteMessage(messageId: string, channelId: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }

    const message = await channel.messages.fetch(messageId);
    await message.delete();
  }

  /**
   * Add a reaction to a message
   * @param messageId - Message to react to
   * @param channelId - Channel containing the message
   * @param emoji - Emoji to add
   */
  async addReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);

    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }

    const message = await channel.messages.fetch(messageId);
    await message.react(emoji);
  }

  /**
   * Subscribe to reaction events on a channel
   * @param channelId - Channel to monitor
   * @param callback - Function to call when reactions are added
   * @returns Unsubscribe function
   */
  subscribeToReactions(
    channelId: string,
    callback: ReactionCallback
  ): () => void {
    if (!this.reactionListeners.has(channelId)) {
      this.reactionListeners.set(channelId, new Set());
    }

    const callbacks = this.reactionListeners.get(channelId);
    if (!callbacks) {
      throw new Error(`Callbacks not found for channel ${channelId}`);
    }
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.reactionListeners.delete(channelId);
      }
    };
  }

  /**
   * Subscribe to incoming message events on a channel
   * @param channelId - Channel to monitor
   * @param callback - Function to call when messages are received
   * @returns Unsubscribe function
   */
  subscribeToMessages(
    channelId: string,
    callback: MessageCallback
  ): () => void {
    if (!this.messageListeners.has(channelId)) {
      this.messageListeners.set(channelId, new Set());
    }

    const callbacks = this.messageListeners.get(channelId);
    if (!callbacks) {
      throw new Error(`Callbacks not found for channel ${channelId}`);
    }
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.messageListeners.delete(channelId);
      }
    };
  }

  /**
   * Send a typing indicator in a Discord channel
   * @param channelId - Channel to send typing indicator in
   */
  async sendTyping(channelId: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }

    await channel.sendTyping();
  }

  /**
   * Create a thread from a message
   * @param messageId - Message to create thread from
   * @param channelId - Channel containing the message
   * @param name - Thread name
   * @param options - Optional thread options
   * @returns Thread data
   */
  async startThread(
    messageId: string,
    channelId: string,
    name: string,
    options?: StartThreadOptions
  ): Promise<ThreadData> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }

    const message = await channel.messages.fetch(messageId);
    const thread = await message.startThread({
      name,
      autoArchiveDuration: options?.autoArchiveDuration as
        | 60
        | 1440
        | 4320
        | 10080
        | undefined,
    });

    return {
      id: thread.id,
      channelId,
      platform: "discord",
    };
  }

  /**
   * Bulk delete messages in a Discord channel
   * @param channelId - Channel to delete messages from
   * @param count - Number of recent messages to delete (max 100)
   * @returns Number of messages actually deleted
   */
  async bulkDelete(channelId: string, count: number): Promise<number> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }

    const deleted = await channel.bulkDelete(count, true);
    return deleted.size;
  }

  /**
   * Get all threads (active and archived) in a Discord channel
   * @param channelId - Channel to get threads from
   * @returns Array of thread data
   */
  async getThreads(channelId: string): Promise<ThreadData[]> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }

    const threads: ThreadData[] = [];

    // Fetch active threads
    const activeThreads = await channel.threads.fetchActive();
    for (const [threadId] of activeThreads.threads) {
      threads.push({ id: threadId, channelId, platform: "discord" });
    }

    // Fetch archived threads
    const archivedThreads = await channel.threads.fetchArchived();
    for (const [threadId] of archivedThreads.threads) {
      threads.push({ id: threadId, channelId, platform: "discord" });
    }

    return threads;
  }

  /**
   * Register a callback for disconnect events
   * @param callback - Function to call when disconnected
   * @returns Unsubscribe function
   */
  onDisconnect(callback: DisconnectCallback): () => void {
    this.disconnectCallbacks.add(callback);
    return () => {
      this.disconnectCallbacks.delete(callback);
    };
  }

  /**
   * Register a callback for error events
   * @param callback - Function to call when an error occurs
   * @returns Unsubscribe function
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }
}
