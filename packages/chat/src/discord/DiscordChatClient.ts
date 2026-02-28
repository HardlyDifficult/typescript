import {
  Client,
  GatewayIntentBits,
  TextChannel,
  ThreadChannel,
} from "discord.js";

import { Channel, type ChannelOperations } from "../Channel.js";
import { ChatClient } from "../ChatClient.js";
import type {
  DeleteMessageOptions,
  DisconnectCallback,
  DiscordConfig,
  ErrorCallback,
  FileAttachment,
  Member,
  MessageCallback,
  MessageContent,
  MessageData,
  MessageQueryOptions,
  ReactionCallback,
  ThreadData,
} from "../types.js";

import {
  setupConnectionResilience,
  setupMessageListener,
  setupReactionListener,
} from "./eventHandlers.js";
import { fetchChannelMembers } from "./fetchChannelMembers.js";
import { getMessages as listMessages } from "./getMessages.js";
import {
  deleteMessage as deleteMessageOp,
  postMessage as postMessageOp,
  updateMessage as updateMessageOp,
} from "./messageOperations.js";
import {
  addReaction as addReactionOp,
  removeAllReactions as removeAllReactionsOp,
  removeReaction as removeReactionOp,
} from "./reactionOperations.js";
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

    setupReactionListener(this.client, this.reactionListeners);
    setupMessageListener(this.client, this.messageListeners);
    setupConnectionResilience(
      this.client,
      this.disconnectCallbacks,
      this.errorCallbacks
    );
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
    return postMessageOp(channel, channelId, content, options);
  }

  async updateMessage(
    messageId: string,
    channelId: string,
    content: MessageContent
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    return updateMessageOp(channel, messageId, content);
  }

  async deleteMessage(
    messageId: string,
    channelId: string,
    options?: DeleteMessageOptions
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    return deleteMessageOp(channel, messageId, options);
  }

  async addReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    await addReactionOp(channel, messageId, emoji);
  }

  async removeReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    await removeReactionOp(channel, messageId, emoji);
  }

  async removeAllReactions(
    messageId: string,
    channelId: string
  ): Promise<void> {
    const channel = await this.fetchTextChannel(channelId);
    await removeAllReactionsOp(channel, messageId);
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
    return startThread(
      channel,
      messageId,
      channelId,
      name,
      autoArchiveDuration
    );
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
