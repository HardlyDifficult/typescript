import type { Platform, ReactionCallback, PostMessageOptions, MessageData } from './types.js';
import { Message, type ReactionAdder } from './Message.js';

/**
 * Interface for platform-specific channel operations
 */
export interface ChannelOperations extends ReactionAdder {
  postMessage(channelId: string, text: string, options?: PostMessageOptions): Promise<MessageData>;
  subscribeToReactions(channelId: string, callback: ReactionCallback): () => void;
}

/**
 * Represents a connected channel with messaging capabilities
 */
export class Channel {
  public readonly id: string;
  public readonly platform: Platform;

  private operations: ChannelOperations;
  private reactionCallbacks: Set<ReactionCallback> = new Set();
  private unsubscribeFromPlatform: (() => void) | null = null;

  constructor(id: string, platform: Platform, operations: ChannelOperations) {
    this.id = id;
    this.platform = platform;
    this.operations = operations;

    // Subscribe to platform reactions and forward to our callbacks
    this.unsubscribeFromPlatform = this.operations.subscribeToReactions(
      id,
      (event) => this.emitReaction(event),
    );
  }

  /**
   * Post a message to this channel
   * @param text - Message content
   * @param options - Optional message settings
   * @returns Message object with chainable reaction methods
   */
  postMessage(text: string, options?: PostMessageOptions): Message {
    const messagePromise = this.operations.postMessage(this.id, text, options);

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
      Promise.resolve(cb(event)).catch((err) => {
        console.error('Reaction callback error:', err);
      })
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
    this.postPromise.then((data) => {
      this.resolvedData = data;
      // Update the readonly properties via Object.defineProperty
      Object.defineProperty(this, 'id', { value: data.id });
      Object.defineProperty(this, 'channelId', { value: data.channelId });
      Object.defineProperty(this, 'platform', { value: data.platform });
    });
  }

  /**
   * Override addReaction to wait for post to complete first
   */
  addReaction(emoji: string): Message {
    // Chain after the post completes
    this.postPromise.then(() => {
      super.addReaction(emoji);
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
      return super.then(onFulfilled, onRejected);
    } catch (err) {
      if (onRejected) {
        return onRejected(err);
      }
      throw err;
    }
  }

  /**
   * Wait for post and all reactions to complete
   */
  override async wait(): Promise<this> {
    await this.postPromise;
    await super.wait();
    return this;
  }
}
