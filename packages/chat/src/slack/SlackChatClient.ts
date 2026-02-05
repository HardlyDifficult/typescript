import { App } from '@slack/bolt';
import { ChatClient } from '../ChatClient.js';
import { Channel, type ChannelOperations } from '../Channel.js';
import type {
  SlackConfig,
  MessageData,
  ReactionCallback,
  ReactionEvent,
  MessageCallback,
  MessageEvent,
  User,
  MessageContent,
  FileAttachment,
  ThreadData,
  StartThreadOptions,
  DisconnectCallback,
  ErrorCallback,
} from '../types.js';
import { toSlackBlocks, type SlackBlock } from '../outputters/slack.js';
import { isDocument } from '../utils.js';

/**
 * Slack chat client implementation using @slack/bolt
 */
export class SlackChatClient extends ChatClient implements ChannelOperations {
  private app: App;
  private reactionCallbacks = new Map<string, Set<ReactionCallback>>();
  private messageCallbacks = new Map<string, Set<MessageCallback>>();
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

    // Set up global reaction event listener
    this.app.event('reaction_added', async ({ event }) => {
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
        channelId: channelId,
        timestamp: new Date(parseFloat(event.event_ts) * 1000),
      };

      for (const callback of callbacks) {
        try {
          await Promise.resolve(callback(reactionEvent));
        } catch (err) {
          console.error('Reaction callback error:', err);
        }
      }
    });

    // Set up global message event listener
    this.app.event('message', async ({ event, context }) => {
      const channelId = event.channel;
      const callbacks = this.messageCallbacks.get(channelId);

      if (!callbacks || callbacks.size === 0) {
        return;
      }

      // Skip bot's own messages
      if (context.botId && 'bot_id' in event && event.bot_id === context.botId) {
        return;
      }

      const user: User = {
        id: 'user' in event ? (event.user ?? '') : '',
        username: undefined,
      };

      const messageEvent: MessageEvent = {
        id: 'ts' in event ? (event.ts ?? '') : '',
        content: 'text' in event ? (event.text ?? '') : '',
        author: user,
        channelId,
        timestamp: 'ts' in event ? new Date(parseFloat(event.ts ?? '0') * 1000) : new Date(),
      };

      for (const callback of callbacks) {
        try {
          await Promise.resolve(callback(messageEvent));
        } catch (err) {
          console.error('Message callback error:', err);
        }
      }
    });
  }

  /**
   * Connect to Slack and return a channel object
   */
  async connect(channelId: string): Promise<Channel> {
    await this.app.start();
    return new Channel(channelId, 'slack', this);
  }

  /**
   * Disconnect from Slack
   */
  async disconnect(): Promise<void> {
    await this.app.stop();
    this.reactionCallbacks.clear();
    this.messageCallbacks.clear();
    this.disconnectCallbacks.clear();
    this.errorCallbacks.clear();
  }

  /**
   * Post a message to a Slack channel
   */
  async postMessage(
    channelId: string,
    content: MessageContent,
    options?: { threadTs?: string; files?: FileAttachment[] },
  ): Promise<MessageData> {
    let text: string;
    let blocks: SlackBlock[] | undefined;

    if (isDocument(content)) {
      blocks = toSlackBlocks(content.getBlocks());
      text = content.toPlainText().trim() || 'Message'; // fallback text for accessibility
    } else {
      text = content;
    }

    // If files are provided, upload them and attach to the message
    if (options?.files && options.files.length > 0) {
      for (const file of options.files) {
        const fileContent =
          typeof file.content === 'string' ? file.content : file.content.toString('base64');
        await this.app.client.filesUploadV2({
          channel_id: channelId,
          content: fileContent,
          filename: file.name,
          initial_comment: text,
          thread_ts: options?.threadTs,
        });
      }

      // For file uploads, the message is created by the upload
      // Return a synthetic message data with the upload timestamp
      // Post the text message separately if there are also blocks
      if (blocks) {
        const result = await this.app.client.chat.postMessage({
          channel: channelId,
          text,
          blocks,
          thread_ts: options?.threadTs,
        });
        if (result.ts === undefined) {
          throw new Error('Slack API did not return a message timestamp');
        }
        return { id: result.ts, channelId, platform: 'slack' };
      }

      // Return a placeholder - the file upload created the message
      return { id: '', channelId, platform: 'slack' };
    }

    const result = await this.app.client.chat.postMessage({
      channel: channelId,
      text,
      blocks,
      thread_ts: options?.threadTs,
    });

    if (result.ts === undefined) {
      throw new Error('Slack API did not return a message timestamp');
    }
    return {
      id: result.ts,
      channelId: channelId,
      platform: 'slack',
    };
  }

  /**
   * Update a message in a Slack channel
   */
  async updateMessage(
    messageId: string,
    channelId: string,
    content: MessageContent,
  ): Promise<void> {
    let text: string;
    let blocks: SlackBlock[] | undefined;

    if (isDocument(content)) {
      blocks = toSlackBlocks(content.getBlocks());
      text = content.toPlainText().trim() || 'Message';
    } else {
      text = content;
    }

    await this.app.client.chat.update({
      channel: channelId,
      ts: messageId,
      text,
      blocks,
    });
  }

  /**
   * Delete a message from a Slack channel
   */
  async deleteMessage(messageId: string, channelId: string): Promise<void> {
    await this.app.client.chat.delete({
      channel: channelId,
      ts: messageId,
    });
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(messageId: string, channelId: string, emoji: string): Promise<void> {
    // Strip colons from emoji name (e.g., ":thumbsup:" -> "thumbsup")
    const emojiName = emoji.replace(/^:|:$/g, '');

    await this.app.client.reactions.add({
      channel: channelId,
      timestamp: messageId,
      name: emojiName,
    });
  }

  /**
   * Subscribe to reaction events for a specific channel
   */
  subscribeToReactions(channelId: string, callback: ReactionCallback): () => void {
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
  subscribeToMessages(channelId: string, callback: MessageCallback): () => void {
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
  async startThread(
    messageId: string,
    channelId: string,
    _name: string,
    _options?: StartThreadOptions,
  ): Promise<ThreadData> {
    // In Slack, threads are created by replying to a message.
    // Return the message timestamp as the thread ID
    return {
      id: messageId,
      channelId,
      platform: 'slack',
    };
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
        if (msg.ts) {
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
    const threads: ThreadData[] = [];

    const history = await this.app.client.conversations.history({
      channel: channelId,
      limit: 200,
    });

    if (history.messages) {
      for (const msg of history.messages) {
        if (msg.reply_count && msg.reply_count > 0 && msg.ts) {
          threads.push({
            id: msg.ts,
            channelId,
            platform: 'slack',
          });
        }
      }
    }

    return threads;
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
