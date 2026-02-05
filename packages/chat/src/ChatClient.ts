import type { ChatConfig } from './types';
import type { Channel } from './Channel';

/**
 * Abstract base class for chat platform clients
 * Provides a unified API for Discord and Slack
 */
export abstract class ChatClient {
  constructor(protected readonly config: ChatConfig) {}

  /**
   * Connect to the chat platform and return a channel object
   * @param channelId - Platform-specific channel identifier
   * @returns Channel object for interacting with the channel
   */
  abstract connect(channelId: string): Promise<Channel>;

  /**
   * Disconnect from the chat platform
   */
  abstract disconnect(): Promise<void>;
}
