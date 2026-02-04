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

  protected pendingReactions: Promise<void> = Promise.resolve();
  protected operations: MessageOperations;

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
   * @returns ReplyMessage that can be awaited to handle success/failure
   */
  postReply(content: MessageContent): ReplyMessage {
    const replyPromise = this.operations.postReply(this.channelId, this.id, content);
    return new ReplyMessage(replyPromise, this.operations, this.platform);
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
   * @example
   * ```typescript
   * const msg = await channel.postMessage('Vote!');
   * msg.addReactions(['👍', '👎']);
   * await msg.waitForReactions();
   * ```
   */
  async waitForReactions(): Promise<void> {
    await this.pendingReactions;
  }
}

/**
 * A reply message that is still being posted.
 * Use `.wait()` to await completion and handle errors.
 */
export class ReplyMessage extends Message {
  private replyPromise: Promise<MessageData>;

  constructor(
    replyPromise: Promise<MessageData>,
    operations: MessageOperations,
    platform: Platform,
  ) {
    // Initialize with placeholder data
    super({ id: '', channelId: '', platform }, operations);
    this.replyPromise = replyPromise;

    // Update our data when the reply completes
    this.replyPromise
      .then((data) => {
        Object.defineProperty(this, 'id', { value: data.id });
        Object.defineProperty(this, 'channelId', { value: data.channelId });
        Object.defineProperty(this, 'platform', { value: data.platform });
      })
      .catch(() => {
        // Errors handled via wait()
      });
  }

  /**
   * Override addReactions to wait for reply to complete first
   */
  override addReactions(emojis: string[]): this {
    // Chain reactions after the reply completes, capturing current pendingReactions
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.replyPromise.then(() => currentPendingReactions);
    for (const emoji of emojis) {
      this.pendingReactions = this.pendingReactions.then(() =>
        this.operations.addReaction(this.id, this.channelId, emoji),
      );
    }
    return this;
  }

  /**
   * Wait for reply to complete.
   * Throws if the reply fails - allows callers to handle errors.
   *
   * @example
   * ```typescript
   * const reply = msg.postReply('text');
   * await reply.wait(); // throws if reply fails
   * console.log(reply.id); // now available
   * ```
   */
  async wait(): Promise<this> {
    await this.replyPromise;
    return this;
  }

  /**
   * Wait for reply and all pending reactions to complete.
   */
  override async waitForReactions(): Promise<void> {
    await this.replyPromise;
    await this.pendingReactions;
  }
}
