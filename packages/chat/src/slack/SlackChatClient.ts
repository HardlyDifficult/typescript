import { App } from '@slack/bolt';
import { ChatClient } from '../ChatClient.js';
import { Channel, type ChannelOperations } from '../Channel.js';
import {
  User,
  type SlackConfig,
  type MessageData,
  type PostMessageOptions,
  type ReactionCallback,
  type ReactionEvent,
} from '../types.js';

/**
 * Slack chat client implementation using @slack/bolt
 */
export class SlackChatClient extends ChatClient implements ChannelOperations {
  private app: App;
  private reactionCallbacks: Map<string, Set<ReactionCallback>> = new Map();

  constructor(config: SlackConfig) {
    super(config);

    this.app = new App({
      token: config.token,
      appToken: config.appToken,
      socketMode: config.socketMode ?? true,
    });

    // Set up global reaction event listener
    this.app.event('reaction_added', async ({ event }) => {
      const channelId = event.item.channel;
      const callbacks = this.reactionCallbacks.get(channelId);

      if (!callbacks || callbacks.size === 0) {
        return;
      }

      const reactionEvent: ReactionEvent = {
        emoji: event.reaction,
        user: new User(event.user, undefined),
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
    this.state = 'connecting';

    try {
      await this.app.start();
      this.state = 'connected';
      return new Channel(channelId, 'slack', this);
    } catch (err) {
      this.state = 'error';
      throw err;
    }
  }

  /**
   * Disconnect from Slack
   */
  async disconnect(): Promise<void> {
    await this.app.stop();
    this.state = 'disconnected';
    this.reactionCallbacks.clear();
  }

  /**
   * Post a message to a Slack channel
   */
  async postMessage(
    channelId: string,
    text: string,
    options?: PostMessageOptions
  ): Promise<MessageData> {
    this.ensureConnected();

    const result = await this.app.client.chat.postMessage({
      channel: channelId,
      text: text,
      thread_ts: options?.threadId,
    });

    return {
      id: result.ts!,
      channelId: channelId,
      platform: 'slack',
    };
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void> {
    this.ensureConnected();

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
}
