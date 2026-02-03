import {
  Client,
  GatewayIntentBits,
  TextChannel,
  type MessageReaction,
  type User as DiscordUser,
  type PartialMessageReaction,
  type PartialUser,
} from 'discord.js';
import { ChatClient } from '../ChatClient.js';
import { Channel, type ChannelOperations } from '../Channel.js';
import type {
  DiscordConfig,
  ReactionCallback,
  PostMessageOptions,
  MessageData,
  ReactionEvent,
} from '../types.js';
import { User } from '../types.js';

/**
 * Discord chat client implementation using discord.js
 */
export class DiscordChatClient extends ChatClient implements ChannelOperations {
  private client: Client;
  private reactionListeners: Map<string, Set<ReactionCallback>> = new Map();

  constructor(config: DiscordConfig) {
    super(config);
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });

    this.setupReactionListener();
  }

  /**
   * Set up the global reaction listener that routes events to channel-specific callbacks
   */
  private setupReactionListener(): void {
    this.client.on('messageReactionAdd', async (
      reaction: MessageReaction | PartialMessageReaction,
      user: DiscordUser | PartialUser,
    ) => {
      // Handle partial reactions
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          console.error('Failed to fetch partial reaction:', error);
          return;
        }
      }

      const channelId = reaction.message.channelId;
      const callbacks = this.reactionListeners.get(channelId);

      if (!callbacks || callbacks.size === 0) {
        return;
      }

      const reactionUser = new User(user.id, user.username ?? undefined);

      const event: ReactionEvent = {
        emoji: reaction.emoji.name ?? reaction.emoji.id ?? '',
        user: reactionUser,
        messageId: reaction.message.id,
        channelId: channelId,
        timestamp: new Date(),
      };

      for (const callback of callbacks) {
        try {
          await callback(event);
        } catch (error) {
          console.error('Reaction callback error:', error);
        }
      }
    });
  }

  /**
   * Connect to Discord and return a channel object
   * @param channelId - Discord channel ID
   * @returns Channel object for interacting with the channel
   */
  async connect(channelId: string): Promise<Channel> {
    this.state = 'connecting';

    try {
      const config = this.config as DiscordConfig;
      await this.client.login(config.token);

      const discordChannel = await this.client.channels.fetch(channelId);

      if (!discordChannel || !(discordChannel instanceof TextChannel)) {
        throw new Error(`Channel ${channelId} not found or is not a text channel`);
      }

      this.state = 'connected';

      return new Channel(channelId, 'discord', this);
    } catch (error) {
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    this.reactionListeners.clear();
    await this.client.destroy();
    this.state = 'disconnected';
  }

  /**
   * Post a message to a Discord channel
   * @param channelId - Channel to post to
   * @param text - Message content
   * @param options - Optional message settings
   * @returns Message data with ID
   */
  async postMessage(
    channelId: string,
    text: string,
    options?: PostMessageOptions,
  ): Promise<MessageData> {
    this.ensureConnected();

    const channel = await this.client.channels.fetch(channelId);

    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} not found or is not a text channel`);
    }

    const messageOptions: { content: string; reply?: { messageReference: string } } = {
      content: text,
    };

    // Handle thread replies if threadId is provided
    if (options?.threadId) {
      messageOptions.reply = { messageReference: options.threadId };
    }

    const message = await channel.send(messageOptions);

    return {
      id: message.id,
      channelId: channelId,
      platform: 'discord',
    };
  }

  /**
   * Add a reaction to a message
   * @param messageId - Message to react to
   * @param channelId - Channel containing the message
   * @param emoji - Emoji to add
   */
  async addReaction(messageId: string, channelId: string, emoji: string): Promise<void> {
    this.ensureConnected();

    const channel = await this.client.channels.fetch(channelId);

    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} not found or is not a text channel`);
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
  subscribeToReactions(channelId: string, callback: ReactionCallback): () => void {
    if (!this.reactionListeners.has(channelId)) {
      this.reactionListeners.set(channelId, new Set());
    }

    const callbacks = this.reactionListeners.get(channelId)!;
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.reactionListeners.delete(channelId);
      }
    };
  }
}
