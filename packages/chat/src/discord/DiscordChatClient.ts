import {
  Client,
  type Message as DiscordMessage,
  type User as DiscordUser,
  GatewayIntentBits,
  type MessageReaction,
  type PartialMessage,
  type PartialMessageReaction,
  type PartialUser,
  TextChannel,
  ThreadChannel,
} from "discord.js";

import { Channel, type ChannelOperations } from "../Channel.js";
import { ChatClient } from "../ChatClient.js";
import { MESSAGE_LIMITS } from "../constants.js";
import { toDiscordEmbed } from "../outputters/discord.js";
import type {
  Attachment,
  DeleteMessageOptions,
  DisconnectCallback,
  DiscordConfig,
  ErrorCallback,
  FileAttachment,
  Member,
  MessageCallback,
  MessageContent,
  MessageData,
  MessageEvent,
  MessageQueryOptions,
  ReactionCallback,
  ReactionEvent,
  ThreadData,
  User,
} from "../types.js";
import { isDocument } from "../utils.js";

import { buildMessagePayload } from "./buildMessagePayload.js";
import { fetchChannelMembers } from "./fetchChannelMembers.js";
import { deleteThread, getThreads, startThread } from "./threadOperations.js";

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
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
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

          const attachments: Attachment[] = [];
          for (const [, attachment] of message.attachments) {
            attachments.push({
              url: attachment.url,
              name: attachment.name,
              contentType: attachment.contentType ?? undefined,
              size: attachment.size,
            });
          }

          const event: MessageEvent = {
            id: message.id,
            content: message.content ?? "",
            author,
            channelId,
            timestamp: message.createdAt,
            attachments,
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

  private async fetchTextChannel(
    channelId: string
  ): Promise<TextChannel | ThreadChannel> {
    const channel = await this.client.channels.fetch(channelId);
    if (
      !channel ||
      (!(channel instanceof TextChannel) && !(channel instanceof ThreadChannel))
    ) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`
      );
    }
    return channel;
  }

  async connect(channelId: string): Promise<Channel> {
    await this.client.login(this.token);
    await this.fetchTextChannel(channelId);
    const me = this.client.user;
    if (!me) {
      throw new Error("Discord client user was not available after login");
    }
    this.meValue = {
      id: me.id,
      username: me.username,
      displayName: me.globalName ?? me.username,
      mention: `<@${me.id}>`,
    };
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
    this.meValue = null;
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
    options?: {
      threadTs?: string;
      files?: FileAttachment[];
      linkPreviews?: boolean;
    }
  ): Promise<MessageData> {
    const channel = await this.fetchTextChannel(channelId);
    const payload = buildMessagePayload(content, options);
    const message = await channel.send(payload);
    return { id: message.id, channelId, platform: "discord" };
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
    const channel = await this.fetchTextChannel(channelId);
    const message = await channel.messages.fetch(messageId);

    if (isDocument(content)) {
      const embed = toDiscordEmbed(content.getBlocks());
      await message.edit({ embeds: [embed] });
    } else {
      // Clear embeds when switching to text; truncate if over limit
      const limit = MESSAGE_LIMITS.discord;
      const text =
        content.length > limit
          ? `${content.slice(0, limit - 1)}\u2026`
          : content;
      await message.edit({ content: text, embeds: [] });
    }
  }

  /**
   * Delete a message and its thread replies from a Discord channel
   * @param messageId - ID of the message to delete
   * @param channelId - Channel containing the message
   */
  async deleteMessage(
    messageId: string,
    channelId: string,
    options?: DeleteMessageOptions
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    const message = await channel.messages.fetch(messageId);

    // Delete the thread (and all its messages) if one exists
    if (options?.cascadeReplies !== false && message.thread) {
      await message.thread.delete();
    }

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
    const channel = await this.fetchTextChannel(channelId);
    const message = await channel.messages.fetch(messageId);
    await message.react(emoji);
  }

  /**
   * Remove the bot's own reaction from a message
   * @param messageId - Message to remove reaction from
   * @param channelId - Channel containing the message
   * @param emoji - Emoji to remove
   */
  async removeReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    const message = await channel.messages.fetch(messageId);
    const reaction = message.reactions.resolve(emoji);
    if (reaction) {
      await reaction.users.remove();
    }
  }

  /**
   * Remove all reactions from a message
   * @param messageId - Message to clear reactions from
   * @param channelId - Channel containing the message
   */
  async removeAllReactions(
    messageId: string,
    channelId: string
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    const message = await channel.messages.fetch(messageId);
    await message.reactions.removeAll();
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
    let callbacks = this.reactionListeners.get(channelId);
    if (!callbacks) {
      callbacks = new Set();
      this.reactionListeners.set(channelId, callbacks);
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
    let callbacks = this.messageListeners.get(channelId);
    if (!callbacks) {
      callbacks = new Set();
      this.messageListeners.set(channelId, callbacks);
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
    const channel = await this.fetchTextChannel(channelId);
    await channel.sendTyping();
  }

  /**
   * Create a thread from a message
   * @param messageId - Message to create thread from
   * @param channelId - Channel containing the message
   * @param name - Thread name
   * @param autoArchiveDuration - Auto-archive duration in minutes (60, 1440, 4320, 10080)
   * @returns Thread data
   */
  async startThread(
    messageId: string,
    channelId: string,
    name: string,
    autoArchiveDuration?: number
  ): Promise<ThreadData> {
    const channel = await this.fetchTextChannel(channelId);
    return startThread(
      channel,
      messageId,
      channelId,
      name,
      autoArchiveDuration
    );
  }

  /**
   * Bulk delete messages in a Discord channel
   * @param channelId - Channel to delete messages from
   * @param count - Number of recent messages to delete (max 100)
   * @returns Number of messages actually deleted
   */
  async bulkDelete(channelId: string, count: number): Promise<number> {
    const channel = await this.fetchTextChannel(channelId);
    if (!(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} is not a text channel`);
    }
    const deleted = await channel.bulkDelete(count, true);
    return deleted.size;
  }

  async getMessages(
    channelId: string,
    options: MessageQueryOptions = {}
  ): Promise<MessageData[]> {
    const channel = await this.fetchTextChannel(channelId);
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const messages = await channel.messages.fetch({ limit });
    const afterDate = toDate(options.after);
    const beforeDate = toDate(options.before);
    const authorFilter =
      options.author === "me"
        ? this.me?.id
        : options.author !== undefined
          ? normalizeAuthorFilter(options.author)
          : undefined;

    const output: MessageData[] = [];
    for (const [, message] of messages) {
      if (message.partial) {
        continue;
      }

      if (afterDate !== undefined && message.createdAt <= afterDate) {
        continue;
      }
      if (beforeDate !== undefined && message.createdAt >= beforeDate) {
        continue;
      }

      const authorId = message.author?.id;
      const authorUsername = message.author?.username;
      if (authorFilter !== undefined) {
        const normalizedUsername = authorUsername?.toLowerCase();
        if (
          authorId !== authorFilter &&
          normalizedUsername !== authorFilter.toLowerCase()
        ) {
          continue;
        }
      }

      const attachments: Attachment[] = [];
      for (const [, attachment] of message.attachments) {
        attachments.push({
          url: attachment.url,
          name: attachment.name,
          contentType: attachment.contentType ?? undefined,
          size: attachment.size,
        });
      }

      output.push({
        id: message.id,
        channelId,
        platform: "discord",
        content: message.content ?? "",
        author:
          authorId !== undefined
            ? { id: authorId, username: authorUsername ?? undefined }
            : undefined,
        timestamp: message.createdAt,
        attachments,
      });
    }

    return output;
  }

  /**
   * Get all threads (active and archived) in a Discord channel
   * @param channelId - Channel to get threads from
   * @returns Array of thread data
   */
  async getThreads(channelId: string): Promise<ThreadData[]> {
    const channel = await this.fetchTextChannel(channelId);
    if (!(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} is not a text channel`);
    }
    return getThreads(channel, channelId);
  }

  /**
   * Delete a thread in a Discord channel
   * @param threadId - ID of the thread to delete
   */
  async deleteThread(threadId: string, _channelId: string): Promise<void> {
    await deleteThread(this.client, threadId);
  }

  /**
   * Post a message to a thread channel
   * In Discord, the threadId IS the channel to post in (threads are channels)
   */
  async postToThread(
    threadId: string,
    _channelId: string,
    content: MessageContent,
    options?: { files?: FileAttachment[] }
  ): Promise<MessageData> {
    return this.postMessage(threadId, content, { files: options?.files });
  }

  /**
   * Subscribe to messages in a specific thread
   * In Discord, threadId IS the thread channel — reuse message subscription
   */
  subscribeToThread(
    threadId: string,
    _channelId: string,
    callback: MessageCallback
  ): () => void {
    return this.subscribeToMessages(threadId, callback);
  }

  async getMembers(channelId: string): Promise<Member[]> {
    const channel = await this.fetchTextChannel(channelId);
    if (!(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} is not a text channel`);
    }
    return fetchChannelMembers(channel);
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

function toDate(input: MessageQueryOptions["after"]): Date | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? undefined : input;
  }
  if (typeof input === "number") {
    const ms = input > 10_000_000_000 ? input : input * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return toDate(Number(trimmed));
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeAuthorFilter(author: string): string {
  const trimmed = author.trim();
  const mentionMatch = /^<@([^>]+)>$/.exec(trimmed);
  if (mentionMatch?.[1] !== undefined && mentionMatch[1] !== "") {
    return mentionMatch[1];
  }
  return trimmed.replace(/^@/, "").toLowerCase();
}
