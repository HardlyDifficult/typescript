import type {
  MessageData,
  MessageContent,
  Platform,
  ReactionCallback,
  ThreadData,
  StartThreadOptions,
} from './types';

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
  subscribeToReactions(messageId: string, callback: ReactionCallback): () => void;
  startThread(
    messageId: string,
    channelId: string,
    name: string,
    options?: StartThreadOptions,
  ): Promise<ThreadData>;
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
  /** @internal */
  reactionUnsubscribers: (() => void)[] = [];

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
   * Listen for reactions on this message
   * @param callback - Function called when users add reactions to this message
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * await channel
   *   .postMessage("Vote: (1) Pizza, (2) Burgers, (3) Salad")
   *   .addReactions(["1️⃣", "2️⃣", "3️⃣"])
   *   .onReaction((event) => {
   *     console.log(`${event.user.username} voted ${event.emoji}`);
   *   });
   * ```
   */
  onReaction(callback: ReactionCallback): this {
    const unsubscribe = this.operations.subscribeToReactions(this.id, callback);
    this.reactionUnsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * Stop listening for reactions on this message
   */
  offReaction(): void {
    for (const unsub of this.reactionUnsubscribers) {
      unsub();
    }
    this.reactionUnsubscribers = [];
  }

  /**
   * Post a reply in this message's thread
   * @param content - Reply content (string or Document)
   * @returns ReplyMessage that can be awaited to handle success/failure
   */
  postReply(content: MessageContent): Message & PromiseLike<Message> {
    const replyPromise = this.operations.postReply(this.channelId, this.id, content);
    return new ReplyMessage(replyPromise, this.operations, this.platform);
  }

  /**
   * Create a thread from this message
   * @param name - Thread name
   * @param options - Optional thread options
   * @returns Channel-like object for posting into the thread
   */
  async startThread(name: string, options?: StartThreadOptions): Promise<ThreadData> {
    return this.operations.startThread(this.id, this.channelId, name, options);
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
 * Implements PromiseLike so it can be directly awaited:
 *   const reply = await msg.postReply('text');
 */
export class ReplyMessage extends Message implements PromiseLike<Message> {
  private replyPromise: Promise<MessageData>;
  private deferredReactionCallbacks: ReactionCallback[] = [];

  constructor(
    replyPromise: Promise<MessageData>,
    operations: MessageOperations,
    platform: Platform,
  ) {
    // Initialize with placeholder data
    super({ id: '', channelId: '', platform }, operations);
    this.replyPromise = replyPromise;

    // Update our data when the reply completes and subscribe any deferred listeners
    this.replyPromise
      .then((data) => {
        Object.defineProperty(this, 'id', { value: data.id });
        Object.defineProperty(this, 'channelId', { value: data.channelId });
        Object.defineProperty(this, 'platform', { value: data.platform });

        // Subscribe deferred reaction callbacks now that we have the message ID
        for (const callback of this.deferredReactionCallbacks) {
          const unsubscribe = this.operations.subscribeToReactions(data.id, callback);
          this.reactionUnsubscribers.push(unsubscribe);
        }
      })
      .catch(() => {
        // Errors surfaced when awaited via then()
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
   * Override onReaction to defer subscription until reply completes
   */
  override onReaction(callback: ReactionCallback): this {
    this.deferredReactionCallbacks.push(callback);
    return this;
  }

  /**
   * Makes ReplyMessage directly awaitable.
   * Resolves to a plain Message (not thenable) to prevent infinite await loops.
   */
  then<TResult1 = Message, TResult2 = never>(
    onfulfilled?: ((value: Message) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const resolved = this.replyPromise.then(async () => {
      await this.pendingReactions;
      const msg = new Message(
        { id: this.id, channelId: this.channelId, platform: this.platform },
        this.operations,
      );
      msg.reactionUnsubscribers = this.reactionUnsubscribers;
      return msg;
    });
    return resolved.then(onfulfilled, onrejected);
  }

  /**
   * Wait for reply and all pending reactions to complete.
   */
  override async waitForReactions(): Promise<void> {
    await this.replyPromise;
    await this.pendingReactions;
  }
}
