import { App } from "@slack/bolt";

import { Channel, type ChannelOperations } from "../Channel.js";
import { ChatClient } from "../ChatClient.js";
import type {
  DeleteMessageOptions,
  DisconnectCallback,
  ErrorCallback,
  FileAttachment,
  Member,
  MessageCallback,
  MessageContent,
  MessageData,
  MessageQueryOptions,
  ReactionCallback,
  ReactionEvent,
  SlackConfig,
  ThreadData,
  User,
} from "../types.js";

import {
  buildMessageEvent,
  type SlackMessagePayload,
} from "./buildMessageEvent.js";
import { fetchChannelMembers } from "./fetchChannelMembers.js";
import { getThreads } from "./getThreads.js";
import {
  deleteMessage,
  postMessage,
  updateMessage,
} from "./messageOperations.js";
import { removeAllReactions } from "./removeAllReactions.js";

/**
 * Slack chat client implementation using @slack/bolt
 */
export class SlackChatClient extends ChatClient implements ChannelOperations {
  private app: App;
  private slackBotId: string | null = null;
  private reactionCallbacks = new Map<string, Set<ReactionCallback>>();
  private messageCallbacks = new Map<string, Set<MessageCallback>>();
  private threadCallbacks = new Map<string, Set<MessageCallback>>();
  private disconnectCallbacks = new Set<DisconnectCallback>();
  private errorCallbacks = new Set<ErrorCallback>();

  constructor(config: SlackConfig) {
    super(config);

    const token = config.token ?? process.env.SLACK_BOT_TOKEN;
    const appToken = config.appToken ?? process.env.SLACK_APP_TOKEN;

    this.app = new App({
      token,
      appToken,
      socketMode: config.socketMode ?? true,
    });

    // Forward @slack/bolt errors to registered error callbacks
    this.app.error(async (error) => {
      const wrappedError =
        error instanceof Error ? error : new Error(String(error));
      for (const callback of this.errorCallbacks) {
        try {
          await callback(wrappedError);
        } catch (err) {
          console.error("Error callback error:", err);
        }
      }
    });

    // Set up global reaction event listener
    this.app.event("reaction_added", async ({ event }) => {
      const channelId = event.item.channel;
      const callbacks = this.reactionCallbacks.get(channelId);

      if (!callbacks || callbacks.size === 0) {
        return;
      }

      const user: User = { id: event.user, username: undefined };

      const reactionEvent: ReactionEvent = {
        emoji: event.reaction,
        user,
        messageId: event.item.ts,
        channelId,
        timestamp: new Date(parseFloat(event.event_ts) * 1000),
      };

      for (const callback of callbacks) {
        try {
          await Promise.resolve(callback(reactionEvent));
        } catch (err) {
          console.error("Reaction callback error:", err);
        }
      }
    });

    // Set up global message event listener
    // @slack/bolt's message event is a complex union — narrow to our typed subset
    this.app.event("message", async ({ event, context }) => {
      const payload = event as SlackMessagePayload;

      // Skip bot's own messages
      if (
        context.botId !== undefined &&
        context.botId !== "" &&
        payload.bot_id === context.botId
      ) {
        return;
      }

      const messageEvent = buildMessageEvent(payload);

      // Determine if this is a thread reply (thread_ts present and differs from ts)
      const { thread_ts: threadTs } = payload;
      const isThreadReply = threadTs !== undefined && threadTs !== payload.ts;

      if (isThreadReply) {
        const callbacks = this.threadCallbacks.get(threadTs);
        if (!callbacks || callbacks.size === 0) {
          return;
        }
        messageEvent.threadId = threadTs;
        for (const callback of callbacks) {
          try {
            await Promise.resolve(callback(messageEvent));
          } catch (err) {
            console.error("Message callback error:", err);
          }
        }
      } else {
        const callbacks = this.messageCallbacks.get(payload.channel);
        if (!callbacks || callbacks.size === 0) {
          return;
        }
        for (const callback of callbacks) {
          try {
            await Promise.resolve(callback(messageEvent));
          } catch (err) {
            console.error("Message callback error:", err);
          }
        }
      }
    });
  }

  /**
   * Connect to Slack and return a channel object
   */
  async connect(channelId: string): Promise<Channel> {
    await this.app.start();
    await this.hydrateIdentity();
    return new Channel(channelId, "slack", this);
  }

  private async hydrateIdentity(): Promise<void> {
    const auth = await this.app.client.auth.test();
    const userId = auth.user_id;
    if (userId === undefined || userId === "") {
      throw new Error("Slack auth.test did not return user_id");
    }

    const username =
      auth.user !== undefined && auth.user !== "" ? auth.user : userId;
    this.meValue = {
      id: userId,
      username,
      displayName: username,
      mention: `<@${userId}>`,
    };
    this.slackBotId =
      auth.bot_id !== undefined && auth.bot_id !== "" ? auth.bot_id : null;
  }

  /**
   * Disconnect from Slack
   */
  async disconnect(): Promise<void> {
    await this.app.stop();
    this.reactionCallbacks.clear();
    this.messageCallbacks.clear();
    this.threadCallbacks.clear();
    this.disconnectCallbacks.clear();
    this.errorCallbacks.clear();
    this.meValue = null;
    this.slackBotId = null;
  }

  /**
   * Post a message to a Slack channel
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
    return postMessage(this.app, channelId, content, options);
  }

  /**
   * Update a message in a Slack channel
   */
  async updateMessage(
    messageId: string,
    channelId: string,
    content: MessageContent
  ): Promise<void> {
    await updateMessage(this.app, messageId, channelId, content);
  }

  /**
   * Delete a message and its thread replies from a Slack channel
   */
  async deleteMessage(
    messageId: string,
    channelId: string,
    options?: DeleteMessageOptions
  ): Promise<void> {
    await deleteMessage(this.app, messageId, channelId, options);
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void> {
    // Strip colons from emoji name (e.g., ":thumbsup:" -> "thumbsup")
    const emojiName = emoji.replace(/^:|:$/g, "");

    await this.app.client.reactions.add({
      channel: channelId,
      timestamp: messageId,
      name: emojiName,
    });
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void> {
    const emojiName = emoji.replace(/^:|:$/g, "");

    await this.app.client.reactions.remove({
      channel: channelId,
      timestamp: messageId,
      name: emojiName,
    });
  }

  /**
   * Remove all of the bot's reactions from a message.
   * Slack only allows removing the authenticated user's own reactions.
   */
  async removeAllReactions(
    messageId: string,
    channelId: string
  ): Promise<void> {
    await removeAllReactions(this.app, messageId, channelId);
  }

  /**
   * Subscribe to reaction events for a specific channel
   */
  subscribeToReactions(
    channelId: string,
    callback: ReactionCallback
  ): () => void {
    let callbacks = this.reactionCallbacks.get(channelId);
    if (!callbacks) {
      callbacks = new Set();
      this.reactionCallbacks.set(channelId, callbacks);
    }
    callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      const channelCallbacks = this.reactionCallbacks.get(channelId);
      if (channelCallbacks) {
        channelCallbacks.delete(callback);
        if (channelCallbacks.size === 0) {
          this.reactionCallbacks.delete(channelId);
        }
      }
    };
  }

  /**
   * Subscribe to incoming message events on a channel
   */
  subscribeToMessages(
    channelId: string,
    callback: MessageCallback
  ): () => void {
    let callbacks = this.messageCallbacks.get(channelId);
    if (!callbacks) {
      callbacks = new Set();
      this.messageCallbacks.set(channelId, callbacks);
    }
    callbacks.add(callback);

    return () => {
      const channelCallbacks = this.messageCallbacks.get(channelId);
      if (channelCallbacks) {
        channelCallbacks.delete(callback);
        if (channelCallbacks.size === 0) {
          this.messageCallbacks.delete(channelId);
        }
      }
    };
  }

  /**
   * Send a typing indicator (not directly supported in Slack bot API - no-op)
   */
  async sendTyping(_channelId: string): Promise<void> {
    // Slack does not support bot typing indicators via the API
  }

  /**
   * Create a thread from a message in Slack
   * Slack threads are implicit - posting a reply creates the thread
   */
  startThread(
    messageId: string,
    channelId: string,
    _name: string,
    _autoArchiveDuration?: number
  ): Promise<ThreadData> {
    // In Slack, threads are created by replying to a message.
    // Return the message timestamp as the thread ID
    return Promise.resolve({
      id: messageId,
      channelId,
      platform: "slack",
    });
  }

  /**
   * Bulk delete messages in a Slack channel
   */
  async bulkDelete(channelId: string, count: number): Promise<number> {
    // Slack doesn't have a bulkDelete API; delete messages one by one
    const history = await this.app.client.conversations.history({
      channel: channelId,
      limit: count,
    });

    let deleted = 0;
    if (history.messages) {
      for (const msg of history.messages) {
        if (msg.ts !== undefined && msg.ts !== "") {
          try {
            await this.app.client.chat.delete({
              channel: channelId,
              ts: msg.ts,
            });
            deleted++;
          } catch {
            // Some messages may not be deletable (e.g., others' messages without admin)
          }
        }
      }
    }

    return deleted;
  }

  async getMessages(
    channelId: string,
    options: MessageQueryOptions = {}
  ): Promise<MessageData[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const oldest = toSlackTimestamp(options.after);
    const latest = toSlackTimestamp(options.before);
    const afterDate = toDate(options.after);
    const beforeDate = toDate(options.before);

    const history = await this.app.client.conversations.history({
      channel: channelId,
      limit,
      ...(oldest !== undefined ? { oldest } : {}),
      ...(latest !== undefined ? { latest } : {}),
      ...(oldest !== undefined || latest !== undefined
        ? { inclusive: false }
        : {}),
    });

    const messages: MessageData[] = [];
    for (const rawMessage of history.messages ?? []) {
      const message = rawMessage as SlackHistoryMessage;
      if (message.ts === undefined || message.ts === "") {
        continue;
      }

      const timestamp = new Date(parseFloat(message.ts) * 1000);
      if (!Number.isFinite(timestamp.getTime())) {
        continue;
      }
      if (afterDate !== undefined && timestamp <= afterDate) {
        continue;
      }
      if (beforeDate !== undefined && timestamp >= beforeDate) {
        continue;
      }
      if (!this.matchesAuthorFilter(message, options.author)) {
        continue;
      }

      const authorId = message.user ?? message.bot_id;
      messages.push({
        id: message.ts,
        channelId,
        platform: "slack",
        content: message.text ?? "",
        author:
          authorId !== undefined
            ? {
                id: authorId,
                username:
                  message.username !== undefined && message.username !== ""
                    ? message.username
                    : undefined,
              }
            : undefined,
        timestamp,
        attachments: extractSlackAttachments(message),
      });
    }

    return messages;
  }

  private matchesAuthorFilter(
    message: SlackHistoryMessage,
    author: MessageQueryOptions["author"]
  ): boolean {
    if (author === undefined) {
      return true;
    }
    if (author === "me") {
      const meId = this.me?.id;
      return (
        (meId !== undefined && meId !== "" && message.user === meId) ||
        (this.slackBotId !== null && message.bot_id === this.slackBotId)
      );
    }

    const normalizedAuthor = normalizeAuthorFilter(author);
    return (
      (message.user !== undefined && message.user === normalizedAuthor) ||
      (message.bot_id !== undefined && message.bot_id === normalizedAuthor)
    );
  }

  /**
   * Get all threads in a Slack channel
   */
  async getThreads(channelId: string): Promise<ThreadData[]> {
    return getThreads(this.app, channelId);
  }

  /**
   * Delete a thread in a Slack channel.
   * Deletes the parent message and all replies.
   */
  async deleteThread(threadId: string, channelId: string): Promise<void> {
    await this.deleteMessage(threadId, channelId);
  }

  async getMembers(channelId: string): Promise<Member[]> {
    return fetchChannelMembers(this.app, channelId);
  }

  /**
   * Post a message to a thread
   * Slack posts to the parent channel with thread_ts
   */
  async postToThread(
    threadId: string,
    channelId: string,
    content: MessageContent,
    options?: { files?: FileAttachment[] }
  ): Promise<MessageData> {
    return this.postMessage(channelId, content, {
      threadTs: threadId,
      files: options?.files,
    });
  }

  /**
   * Subscribe to messages in a specific thread
   * Callbacks are keyed by threadId (parent message ts)
   */
  subscribeToThread(
    threadId: string,
    _channelId: string,
    callback: MessageCallback
  ): () => void {
    let callbacks = this.threadCallbacks.get(threadId);
    if (!callbacks) {
      callbacks = new Set();
      this.threadCallbacks.set(threadId, callbacks);
    }
    callbacks.add(callback);

    return () => {
      const cbs = this.threadCallbacks.get(threadId);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this.threadCallbacks.delete(threadId);
        }
      }
    };
  }

  /**
   * Register a callback for disconnect events
   */
  onDisconnect(callback: DisconnectCallback): () => void {
    this.disconnectCallbacks.add(callback);
    return () => {
      this.disconnectCallbacks.delete(callback);
    };
  }

  /**
   * Register a callback for error events
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }
}

interface SlackFileAttachment {
  url_private?: string;
  name?: string;
  mimetype?: string | null;
  size?: number;
}

interface SlackHistoryMessage {
  ts?: string;
  text?: string;
  user?: string;
  username?: string;
  bot_id?: string;
  files?: SlackFileAttachment[];
}

function toSlackTimestamp(
  input: MessageQueryOptions["after"]
): string | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input instanceof Date) {
    return String(input.getTime() / 1000);
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      return undefined;
    }
    return String(input);
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return String(date.getTime() / 1000);
}

function toDate(input: MessageQueryOptions["after"]): Date | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? undefined : input;
  }
  if (typeof input === "number") {
    // Heuristic: treat large numbers as ms, small numbers as seconds.
    const ms = input > 10_000_000_000 ? input : input * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const trimmed = input.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return toDate(numeric);
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeAuthorFilter(author: string): string {
  const mentionMatch = /^<@([^>|]+)(?:\|[^>]+)?>$/.exec(author.trim());
  if (mentionMatch?.[1] !== undefined && mentionMatch[1] !== "") {
    return mentionMatch[1];
  }
  return author.trim().replace(/^@/, "");
}

function extractSlackAttachments(message: SlackHistoryMessage) {
  const attachments: NonNullable<MessageData["attachments"]> = [];
  for (const file of message.files ?? []) {
    const url = file.url_private;
    const name = file.name;
    if (
      url === undefined ||
      url === "" ||
      name === undefined ||
      name === ""
    ) {
      continue;
    }
    attachments.push({
      url,
      name,
      contentType:
        file.mimetype !== undefined &&
        file.mimetype !== null &&
        file.mimetype !== ""
          ? file.mimetype
          : undefined,
      size: file.size,
    });
  }
  return attachments;
}
