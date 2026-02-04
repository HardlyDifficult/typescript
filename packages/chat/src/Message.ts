import type { MessageData, MessageContent, Platform } from './types.js';

/**
 * Interface for the platform-specific reaction adder
 */
export interface ReactionAdder {
  addReaction(messageId: string, channelId: string, emoji: string): Promise<void>;
}

/**
 * Interface for message operations (reactions, updates, deletes, replies)
 */
export interface MessageOperations extends ReactionAdder {
  updateMessage(messageId: string, channelId: string, content: MessageContent): Promise<void>;
  deleteMessage(messageId: string, channelId: string): Promise<void>;
  postReply(channelId: string, threadTs: string, content: MessageContent): Promise<MessageData>;
}

/**
 * Represents a posted message with chainable reaction methods
 */
export class Message {
  public readonly id: string;
  public readonly channelId: string;
  public readonly platform: Platform;

  private pendingReactions: Promise<void> = Promise.resolve();
  private operations: MessageOperations;

  constructor(data: MessageData, operations: MessageOperations) {
    this.id = data.id;
    this.channelId = data.channelId;
    this.platform = data.platform;
    this.operations = operations;
  }

  /**
   * Add multiple emoji reactions to this message
   * @param emojis - Array of emojis to add
   * @returns this for chaining
   */
  addReactions(emojis: string[]): this {
    for (const emoji of emojis) {
      this.pendingReactions = this.pendingReactions.then(() =>
        this.operations.addReaction(this.id, this.channelId, emoji),
      );
    }
    return this;
  }

  /**
   * Post a reply in this message's thread
   * @param content - Reply content (string or Document)
   * @returns Promise that resolves to the reply Message
   */
  postReply(content: MessageContent): Message {
    // Create pending promise for the reply
    const replyPromise = this.operations.postReply(this.channelId, this.id, content);
    
    // Return a Message that will be updated when the reply completes
    // TODO: This should return a PendingMessage once Channel.ts is updated
    const replyMessage = new Message(
      { id: '', channelId: this.channelId, platform: this.platform },
      this.operations,
    );
    
    // Update the message data when the promise resolves
    void replyPromise.then((data) => {
      Object.defineProperty(replyMessage, 'id', { value: data.id });
      Object.defineProperty(replyMessage, 'channelId', { value: data.channelId });
      Object.defineProperty(replyMessage, 'platform', { value: data.platform });
    });
    
    return replyMessage;
  }

  /**
   * Update this message's content
   * @param content - New content (string or Document)
   */
  async update(content: MessageContent): Promise<void> {
    await this.operations.updateMessage(this.id, this.channelId, content);
  }

  /**
   * Delete this message
   */
  async delete(): Promise<void> {
    await this.operations.deleteMessage(this.id, this.channelId);
  }

  /**
   * Wait for all pending reactions to complete.
   * 
   * This makes Message a thenable, allowing: `await msg` after adding reactions.
   * Note: Always provide a callback or use `.waitForReactions()` to avoid
   * infinite recursion when awaiting.
   */
  then<T>(
    onFulfilled?: ((value: Message) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null,
  ): Promise<T> {
    return this.pendingReactions.then(
      () => (onFulfilled ? onFulfilled(this) : (undefined as T)),
      onRejected,
    );
  }

  /**
   * Wait for all pending reactions to complete.
   * Use this instead of `await msg` to avoid thenable behavior.
   */
  async waitForReactions(): Promise<void> {
    await this.pendingReactions;
  }
}
