import { convertMarkdown } from "@hardlydifficult/document-generator";
import { App } from "@slack/bolt";

import { Channel, type ChannelOperations } from "../Channel.js";
import { ChatClient } from "../ChatClient.js";
import { type SlackBlock, toSlackBlocks } from "../outputters/slack.js";
import type {
  DisconnectCallback,
  ErrorCallback,
  FileAttachment,
  Member,
  MessageCallback,
  MessageContent,
  MessageData,
  ReactionCallback,
  ReactionEvent,
  SlackConfig,
  ThreadData,
  User,
} from "../types.js";
import { isDocument } from "../utils.js";

import {
  buildMessageEvent,
  type SlackMessagePayload,
} from "./buildMessageEvent.js";
import { fetchChannelMembers } from "./fetchChannelMembers.js";
import { getThreads } from "./getThreads.js";
import { removeAllReactions } from "./removeAllReactions.js";

/**
 * Slack chat client implementation using @slack/bolt
 */
export class SlackChatClient extends ChatClient implements ChannelOperations {
  private app: App;
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
    return new Channel(channelId, "slack", this);
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
    let text: string;
    let blocks: SlackBlock[] | undefined;

    if (isDocument(content)) {
      blocks = toSlackBlocks(content.getBlocks());
      text = content.toPlainText().trim() || "Message"; // fallback text for accessibility
    } else {
      text = convertMarkdown(content, "slack");
    }

    // Suppress link preview unfurling by default
    const unfurl =
      options?.linkPreviews === true
        ? {}
        : { unfurl_links: false, unfurl_media: false };

    // If files are provided, upload them and attach to the message
    if (options?.files && options.files.length > 0) {
      for (let i = 0; i < options.files.length; i++) {
        const file = options.files[i];
        await this.app.client.filesUploadV2({
          channel_id: channelId,
          filename: file.name,
          // Only attach the text as initial_comment on the first file to avoid duplicates
          ...(i === 0 ? { initial_comment: text } : {}),
          thread_ts: options.threadTs,
          // String content uses the content field; binary uses the file field
          ...(typeof file.content === "string"
            ? { content: file.content }
            : { file: file.content }),
        });
      }

      // Post the text message separately if there are also blocks (rich document)
      if (blocks) {
        const result = await this.app.client.chat.postMessage({
          channel: channelId,
          text,
          blocks,
          thread_ts: options.threadTs,
          ...unfurl,
        });
        if (result.ts === undefined) {
          throw new Error("Slack API did not return a message timestamp");
        }
        return { id: result.ts, channelId, platform: "slack" };
      }

      // File uploads create messages implicitly; the Slack API doesn't reliably
      // return a message timestamp from filesUploadV2, so return empty ID.
      return { id: "", channelId, platform: "slack" };
    }

    const result = await this.app.client.chat.postMessage({
      channel: channelId,
      text,
      blocks,
      thread_ts: options?.threadTs,
      ...unfurl,
    });

    if (result.ts === undefined) {
      throw new Error("Slack API did not return a message timestamp");
    }
    return {
      id: result.ts,
      channelId,
      platform: "slack",
    };
  }

  /**
   * Update a message in a Slack channel
   */
  async updateMessage(
    messageId: string,
    channelId: string,
    content: MessageContent
  ): Promise<void> {
    let text: string;
    let blocks: SlackBlock[] | undefined;

    if (isDocument(content)) {
      blocks = toSlackBlocks(content.getBlocks());
      text = content.toPlainText().trim() || "Message";
    } else {
      text = convertMarkdown(content, "slack");
    }

    await this.app.client.chat.update({
      channel: channelId,
      ts: messageId,
      text,
      blocks,
    });
  }

  /**
   * Delete a message and its thread replies from a Slack channel
   */
  async deleteMessage(messageId: string, channelId: string): Promise<void> {
    // Fetch and delete thread replies first
    const replies = await this.app.client.conversations.replies({
      channel: channelId,
      ts: messageId,
    });

    if (replies.messages && replies.messages.length > 1) {
      // First message is the parent — delete replies (rest) in reverse order
      for (const reply of replies.messages.slice(1).reverse()) {
        if (reply.ts !== undefined && reply.ts !== "") {
          await this.app.client.chat.delete({
            channel: channelId,
            ts: reply.ts,
          });
        }
      }
    }

    // Delete the parent message
    await this.app.client.chat.delete({
      channel: channelId,
      ts: messageId,
    });
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
