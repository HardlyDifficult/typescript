import type { Platform, ReactionCallback, MessageData } from './types.js';
import { Message, type ReactionAdder } from './Message.js';

/**
 * Interface for platform-specific channel operations
 */
export interface ChannelOperations extends ReactionAdder {
  postMessage(channelId: string, text: string): Promise<MessageData>;
  subscribeToReactions(channelId: string, callback: ReactionCallback): () => void;
}

/**
 * Represents a connected channel with messaging capabilities
 */
export class Channel {
  public readonly id: string;
  public readonly platform: Platform;

  private operations: ChannelOperations;
  private reactionCallbacks = new Set<ReactionCallback>();
  private unsubscribeFromPlatform: (() => void) | null = null;

  constructor(id: string, platform: Platform, operations: ChannelOperations) {
    this.id = id;
    this.platform = platform;
    this.operations = operations;

    // Subscribe to platform reactions and forward to our callbacks
    this.unsubscribeFromPlatform = this.operations.subscribeToReactions(id, (event) =>
      this.emitReaction(event),
    );
  }

  /**
   * Post a message to this channel
   * @param text - Message content
   * @returns Message object with chainable reaction methods
   */
  postMessage(text: string): Message {
    const messagePromise = this.operations.postMessage(this.id, text);

    // Create a Message that will resolve once the post completes
    const pendingMessage = new PendingMessage(messagePromise, this.operations);
    return pendingMessage;
  }

  /**
   * Register a callback for reaction events on this channel
   * @param callback - Function called when users add reactions
   * @returns Unsubscribe function
   */
  onReaction(callback: ReactionCallback): () => void {
    this.reactionCallbacks.add(callback);
    return () => {
      this.reactionCallbacks.delete(callback);
    };
  }

  /**
   * Emit a reaction event to all registered callbacks
   */
  private async emitReaction(event: Parameters<ReactionCallback>[0]): Promise<void> {
    const promises = Array.from(this.reactionCallbacks).map((cb) =>
      Promise.resolve(cb(event)).catch((err: unknown) => {
        console.error('Reaction callback error:', err);
      }),
    );
    await Promise.all(promises);
  }

  /**
   * Disconnect from this channel (cleanup)
   */
  disconnect(): void {
    if (this.unsubscribeFromPlatform) {
      this.unsubscribeFromPlatform();
      this.unsubscribeFromPlatform = null;
    }
    this.reactionCallbacks.clear();
  }
}

/**
 * A Message that is still being posted - supports the same chainable API
 */
class PendingMessage extends Message {
  private postPromise: Promise<MessageData>;
  private resolvedData: MessageData | null = null;

  constructor(postPromise: Promise<MessageData>, reactionAdder: ReactionAdder) {
    // Initialize with placeholder data
    super({ id: '', channelId: '', platform: 'discord' }, reactionAdder);
    this.postPromise = postPromise;

    // Update our data when the post resolves
    void this.postPromise.then((data) => {
      this.resolvedData = data;
      // Update the readonly properties via Object.defineProperty
      Object.defineProperty(this, 'id', { value: data.id });
      Object.defineProperty(this, 'channelId', { value: data.channelId });
      Object.defineProperty(this, 'platform', { value: data.platform });
    });
  }

  /**
   * Override addReactions to wait for post to complete first
   */
  override addReactions(emojis: string[]): this {
    // Chain after the post completes
    void this.postPromise.then(() => {
      super.addReactions(emojis);
    });
    return this;
  }

  /**
   * Wait for post and all reactions to complete
   */
  override async then<T>(
    onFulfilled?: ((value: Message) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null,
  ): Promise<T> {
    try {
      await this.postPromise;
      return await super.then(onFulfilled, onRejected);
    } catch (err) {
      if (onRejected) {
        return onRejected(err);
      }
      throw err;
    }
  }
}
