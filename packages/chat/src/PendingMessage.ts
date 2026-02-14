import { Message, type MessageOperations } from "./Message.js";
import type { MessageData, Platform, ReactionCallback } from "./types.js";

/**
 * A Message that is still being posted.
 * Implements PromiseLike so it can be directly awaited:
 *   const msg = await channel.postMessage('Hello');
 *
 * Also supports synchronous chaining before awaiting:
 *   await channel.postMessage('Vote!').addReactions(['👍', '👎']).onReaction(cb);
 */
export class PendingMessage extends Message implements PromiseLike<Message> {
  private postPromise: Promise<MessageData>;
  private deferredReactionCallbacks: ReactionCallback[] = [];
  private resolved = false;

  constructor(
    postPromise: Promise<MessageData>,
    operations: MessageOperations,
    platform: Platform
  ) {
    // Initialize with placeholder data using the correct platform
    super({ id: "", channelId: "", platform }, operations);
    this.postPromise = postPromise;

    // Update our data when the post resolves and subscribe any deferred listeners
    this.postPromise
      .then((data) => {
        // Update the readonly properties via Object.defineProperty
        Object.defineProperty(this, "id", { value: data.id });
        Object.defineProperty(this, "channelId", { value: data.channelId });
        Object.defineProperty(this, "platform", { value: data.platform });

        // Subscribe deferred reaction callbacks now that we have the message ID
        for (const callback of this.deferredReactionCallbacks) {
          const unsubscribe = this.operations.subscribeToReactions(
            data.id,
            callback
          );
          this.reactionUnsubscribers.push(unsubscribe);
        }
        this.resolved = true;
      })
      .catch(() => {
        // Errors surfaced when awaited via then()
      });
  }

  /**
   * Override addReactions to wait for post to complete first
   */
  override addReactions(emojis: string[]): this {
    // Chain after the post completes, capturing current pendingReactions
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.postPromise.then(
      () => currentPendingReactions
    );
    for (const emoji of emojis) {
      this.pendingReactions = this.pendingReactions.then(() =>
        this.operations.addReaction(this.id, this.channelId, emoji)
      );
    }
    return this;
  }

  /**
   * Override removeReactions to wait for post to complete first
   */
  override removeReactions(emojis: string[]): this {
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.postPromise.then(
      () => currentPendingReactions
    );
    for (const emoji of emojis) {
      this.pendingReactions = this.pendingReactions.then(() =>
        this.operations.removeReaction(this.id, this.channelId, emoji)
      );
    }
    return this;
  }

  /**
   * Override removeAllReactions to wait for post to complete first
   */
  override removeAllReactions(): this {
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.postPromise.then(
      () => currentPendingReactions
    );
    this.pendingReactions = this.pendingReactions.then(() =>
      this.operations.removeAllReactions(this.id, this.channelId)
    );
    return this;
  }

  /**
   * Override onReaction to defer subscription until post completes
   */
  override onReaction(callback: ReactionCallback): this {
    if (this.resolved) {
      super.onReaction(callback);
    } else {
      this.deferredReactionCallbacks.push(callback);
    }
    return this;
  }

  /**
   * Override offReaction to also clear deferred callbacks
   */
  override offReaction(): void {
    this.deferredReactionCallbacks = [];
    super.offReaction();
  }

  /**
   * Makes PendingMessage directly awaitable.
   * Resolves to a plain Message (not thenable) to prevent infinite await loops.
   */
  then<TResult1 = Message, TResult2 = never>(
    onfulfilled?: ((value: Message) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const resolved = this.postPromise.then(async () => {
      await this.pendingReactions;
      // Return a plain Message (no then()) to stop await from recursing
      return this.toSnapshot();
    });
    return resolved.then(onfulfilled, onrejected);
  }

  /**
   * Wait for post and all pending reactions to complete.
   */
  override async waitForReactions(): Promise<void> {
    await this.postPromise;
    await this.pendingReactions;
  }
}
