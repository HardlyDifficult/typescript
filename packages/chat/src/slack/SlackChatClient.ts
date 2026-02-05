import { App } from '@slack/bolt';
import { ChatClient } from '../ChatClient.js';
import { Channel, type ChannelOperations } from '../Channel.js';
import type {
  SlackConfig,
  MessageData,
  ReactionCallback,
  ReactionEvent,
  User,
  MessageContent,
} from '../types.js';
import { toSlackBlocks, type SlackBlock } from '../outputters/slack.js';
import { isDocument } from '../utils.js';

/**
 * Slack chat client implementation using @slack/bolt
 */
export class SlackChatClient extends ChatClient implements ChannelOperations {
  private app: App;
  private reactionCallbacks = new Map<string, Set<ReactionCallback>>();

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
  }

  /**
   * Post a message to a Slack channel
   */
  async postMessage(
    channelId: string,
    content: MessageContent,
    options?: { threadTs?: string },
  ): Promise<MessageData> {
    let text: string;
    let blocks: SlackBlock[] | undefined;

    if (isDocument(content)) {
      blocks = toSlackBlocks(content.getBlocks());
      text = content.toPlainText().trim() || 'Message'; // fallback text for accessibility
    } else {
      text = content;
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
}
