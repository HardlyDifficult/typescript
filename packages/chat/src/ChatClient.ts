import type { Channel } from "./Channel.js";
import type { ChatConfig, ClientIdentity } from "./types.js";

/**
 * Abstract base class for chat platform clients
 * Provides a unified API for Discord and Slack
 */
export abstract class ChatClient {
  protected meValue: ClientIdentity | null = null;

  constructor(protected readonly config: ChatConfig) {}

  /**
   * Identity of the connected bot user.
   * Available after connect() succeeds.
   */
  get me(): ClientIdentity | null {
    return this.meValue;
  }

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
