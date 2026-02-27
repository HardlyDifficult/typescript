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
} from "../types.js";
import { isDocument } from "../utils.js";

import { buildMessagePayload } from "./buildMessagePayload.js";
import { fetchChannelMembers } from "./fetchChannelMembers.js";
import { getMessages as listMessages } from "./getMessages.js";
import { deleteThread, getThreads, startThread } from "./threadOperations.js";

/** Discord chat client implementation using discord.js. */
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

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupReactionListener();
    this.setupMessageListener();
    this.setupConnectionResilience();
  }

  private setupReactionListener(): void {
    this.client.on(
      "messageReactionAdd",
      (
        reaction: MessageReaction | PartialMessageReaction,
        user: DiscordUser | PartialUser
      ): void => {
        void (async (): Promise<void> => {
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

          const event: ReactionEvent = {
            emoji: reaction.emoji.name ?? reaction.emoji.id ?? "",
            user: { id: user.id, username: user.username ?? undefined },
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

  private setupMessageListener(): void {
    this.client.on(
      "messageCreate",
      (message: DiscordMessage | PartialMessage): void => {
        void (async (): Promise<void> => {
          if (message.author?.id === this.client.user?.id) {
            return;
          }

          const { channelId } = message;
          const callbacks = this.messageListeners.get(channelId);
          if (!callbacks || callbacks.size === 0) {
            return;
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

          const event: MessageEvent = {
            id: message.id,
            content: message.cleanContent ?? message.content ?? "",
            author: {
              id: message.author?.id ?? "",
              username: message.author?.username ?? undefined,
            },
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
    return new Channel({
      id: channelId,
      platform: "discord",
      operations: this,
    });
  }

  async disconnect(): Promise<void> {
    this.reactionListeners.clear();
    this.messageListeners.clear();
    this.disconnectCallbacks.clear();
    this.errorCallbacks.clear();
    this.meValue = null;
    await this.client.destroy();
  }

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
      const limit = MESSAGE_LIMITS.discord;
      const text =
        content.length > limit
          ? `${content.slice(0, limit - 1)}\u2026`
          : content;
      await message.edit({ content: text, embeds: [] });
    }
  }

  async deleteMessage(
    messageId: string,
    channelId: string,
    options?: DeleteMessageOptions
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    const message = await channel.messages.fetch(messageId);
    if (options?.cascadeReplies !== false && message.thread) {
      await message.thread.delete();
    }
    await message.delete();
  }

  async addReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    const message = await channel.messages.fetch(messageId);
    await message.react(emoji);
  }

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

  async removeAllReactions(
    messageId: string,
    channelId: string
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    const message = await channel.messages.fetch(messageId);
    await message.reactions.removeAll();
  }

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

  async sendTyping(channelId: string): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    await channel.sendTyping();
  }

  async startThread(
    messageId: string,
    channelId: string,
    name: string,
    autoArchiveDuration?: number
  ): Promise<ThreadData> {
    const channel = await this.fetchTextChannel(channelId);
    return startThread(channel, messageId, channelId, name, autoArchiveDuration);
  }

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
    return listMessages(channel, channelId, options, this.me?.id);
  }

  async getThreads(channelId: string): Promise<ThreadData[]> {
    const channel = await this.fetchTextChannel(channelId);
    if (!(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} is not a text channel`);
    }
    return getThreads(channel, channelId);
  }

  async deleteThread(threadId: string, _channelId: string): Promise<void> {
    await deleteThread(this.client, threadId);
  }

  async getThreadMessages(
    threadId: string,
    _channelId: string,
    options: MessageQueryOptions = {}
  ): Promise<MessageData[]> {
    return this.getMessages(threadId, options);
  }

  async postToThread(
    threadId: string,
    _channelId: string,
    content: MessageContent,
    options?: { files?: FileAttachment[] }
  ): Promise<MessageData> {
    return this.postMessage(threadId, content, { files: options?.files });
  }

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

  onDisconnect(callback: DisconnectCallback): () => void {
    this.disconnectCallbacks.add(callback);
    return () => {
      this.disconnectCallbacks.delete(callback);
    };
  }

  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }
}
