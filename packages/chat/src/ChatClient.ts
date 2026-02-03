import type { ChatConfig, ConnectionState } from './types.js';
import type { Channel } from './Channel.js';

/**
 * Abstract base class for chat platform clients
 * Provides a unified API for Discord and Slack
 */
export abstract class ChatClient {
  protected state: ConnectionState = 'disconnected';

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

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Ensure client is connected before operations
   */
  protected ensureConnected(): void {
    if (this.state !== 'connected') {
      throw new Error('Client is not connected. Call connect() first.');
    }
  }
}
