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
  MessageData,
  ReactionCallback,
  ReactionEvent,
  User,
  MessageContent,
} from '../types.js';
import { toDiscordEmbed, type DiscordEmbed } from '../outputters/discord.js';
import { isDocument } from '../utils.js';

/**
 * Discord chat client implementation using discord.js
 */
export class DiscordChatClient extends ChatClient implements ChannelOperations {
  private client: Client;
  private reactionListeners = new Map<string, Set<ReactionCallback>>();
  private readonly token: string;
  private readonly guildId: string;

  constructor(config: DiscordConfig) {
    super(config);
    this.token = config.token ?? process.env.DISCORD_TOKEN ?? '';
    this.guildId = config.guildId ?? process.env.DISCORD_GUILD_ID ?? '';

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
    this.client.on(
      'messageReactionAdd',
      (
        reaction: MessageReaction | PartialMessageReaction,
        user: DiscordUser | PartialUser,
      ): void => {
        void (async (): Promise<void> => {
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

          const reactionUser: User = { id: user.id, username: user.username ?? undefined };

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
        })();
      },
    );
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
      throw new Error(`Channel ${channelId} not found or is not a text channel`);
    }

    return new Channel(channelId, 'discord', this);
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    this.reactionListeners.clear();
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
    options?: { threadTs?: string },
  ): Promise<MessageData> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} not found or is not a text channel`);
    }

    let messageOptions: {
      content?: string;
      embeds?: DiscordEmbed[];
      messageReference?: { messageId: string };
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
        messageOptions = { content: '\u200B' };
      }
    } else {
      messageOptions = { content };
    }

    // If threadTs is provided (non-empty), use it as a reply reference
    if (options?.threadTs !== undefined && options.threadTs !== '') {
      messageOptions.messageReference = { messageId: options.threadTs };
    }

    const message = await channel.send(messageOptions);

    return {
      id: message.id,
      channelId: channelId,
      platform: 'discord',
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
    content: MessageContent,
  ): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} not found or is not a text channel`);
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
      throw new Error(`Channel ${channelId} not found or is not a text channel`);
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
  async addReaction(messageId: string, channelId: string, emoji: string): Promise<void> {
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
}
