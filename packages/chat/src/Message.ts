import type { MessageData, Platform } from './types.js';

/**
 * Interface for the platform-specific reaction adder
 */
export interface ReactionAdder {
  addReaction(messageId: string, channelId: string, emoji: string): Promise<void>;
}

/**
 * Represents a posted message with chainable reaction methods
 */
export class Message {
  public readonly id: string;
  public readonly channelId: string;
  public readonly platform: Platform;

  private pendingReactions: Promise<void> = Promise.resolve();
  private reactionAdder: ReactionAdder;

  constructor(data: MessageData, reactionAdder: ReactionAdder) {
    this.id = data.id;
    this.channelId = data.channelId;
    this.platform = data.platform;
    this.reactionAdder = reactionAdder;
  }

  /**
   * Add a single emoji reaction to this message
   * @param emoji - Emoji to add (name or unicode)
   * @returns this for chaining
   */
  addReaction(emoji: string): Message {
    this.pendingReactions = this.pendingReactions.then(() =>
      this.reactionAdder.addReaction(this.id, this.channelId, emoji)
    );
    return this;
  }

  /**
   * Add multiple emoji reactions to this message
   * @param emojis - Array of emojis to add
   * @returns this for chaining
   */
  addReactions(emojis: string[]): Message {
    for (const emoji of emojis) {
      this.addReaction(emoji);
    }
    return this;
  }

  /**
   * Wait for all pending reactions to complete
   */
  async then<T>(
    onFulfilled?: ((value: Message) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null,
  ): Promise<T> {
    await this.pendingReactions;
    if (onFulfilled) {
      return onFulfilled(this);
    }
    return this as unknown as T;
  }

  /**
   * Wait for all pending reactions to complete
   */
  async wait(): Promise<this> {
    await this.pendingReactions;
    return this;
  }
}
