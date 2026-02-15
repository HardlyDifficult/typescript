import { StreamingReply } from "./StreamingReply";
import type { Thread } from "./Thread";
import type {
  Attachment,
  FileAttachment,
  MessageContent,
  MessageData,
  Platform,
  ReactionCallback,
  User,
} from "./types";

/**
 * Interface for message operations (reactions, updates, deletes, replies)
 */
export interface MessageOperations {
  addReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void>;
  removeReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void>;
  removeAllReactions(messageId: string, channelId: string): Promise<void>;
  updateMessage(
    messageId: string,
    channelId: string,
    content: MessageContent
  ): Promise<void>;
  deleteMessage(messageId: string, channelId: string): Promise<void>;
  reply(
    channelId: string,
    threadTs: string,
    content: MessageContent,
    files?: FileAttachment[]
  ): Promise<MessageData>;
  subscribeToReactions(
    messageId: string,
    callback: ReactionCallback
  ): () => void;
  startThread(
    messageId: string,
    channelId: string,
    name: string,
    autoArchiveDuration?: number
  ): Promise<Thread>;
}

/**
 * Represents a posted message with chainable reaction methods
 */
export class Message {
  public readonly id: string;
  public readonly channelId: string;
  public readonly platform: Platform;
  public readonly content?: string;
  public readonly author?: User;
  public readonly timestamp?: Date;
  public readonly attachments?: Attachment[];

  protected pendingReactions: Promise<void> = Promise.resolve();
  protected operations: MessageOperations;
  protected reactionUnsubscribers: (() => void)[] = [];
  private trackedEmojis: string[] = [];

  constructor(data: MessageData, operations: MessageOperations) {
    this.id = data.id;
    this.channelId = data.channelId;
    this.platform = data.platform;
    this.content = data.content;
    this.author = data.author;
    this.timestamp = data.timestamp;
    this.attachments = data.attachments;
    this.operations = operations;
  }

  /**
   * Create a plain Message snapshot, transferring reaction unsubscribers.
   * Used by PendingMessage/ReplyMessage to resolve to a non-thenable Message.
   */
  protected toSnapshot(): Message {
    const msg = new Message(
      {
        id: this.id,
        channelId: this.channelId,
        platform: this.platform,
        content: this.content,
        author: this.author,
        timestamp: this.timestamp,
        attachments: this.attachments,
      },
      this.operations
    );
    msg.reactionUnsubscribers = this.reactionUnsubscribers;
    msg.trackedEmojis = this.trackedEmojis;
    return msg;
  }

  /**
   * Add multiple emoji reactions to this message
   * @param emojis - Array of emojis to add
   * @returns this for chaining
   */
  addReactions(emojis: string[]): this {
    for (const emoji of emojis) {
      this.pendingReactions = this.pendingReactions.then(() =>
        this.operations.addReaction(this.id, this.channelId, emoji)
      );
    }
    return this;
  }

  /**
   * Remove multiple emoji reactions from this message
   * @param emojis - Array of emojis to remove
   * @returns this for chaining
   */
  removeReactions(emojis: string[]): this {
    for (const emoji of emojis) {
      this.pendingReactions = this.pendingReactions.then(() =>
        this.operations.removeReaction(this.id, this.channelId, emoji)
      );
    }
    return this;
  }

  /**
   * Remove all reactions from this message (from all users)
   * @returns this for chaining
   */
  removeAllReactions(): this {
    this.pendingReactions = this.pendingReactions.then(() =>
      this.operations.removeAllReactions(this.id, this.channelId)
    );
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
   * Declaratively set the reactions on this message.
   * Computes the diff from the previous `setReactions` call, removing stale
   * emojis and adding new ones. Replaces any existing reaction handler.
   * @param emojis - The complete set of emojis that should be on this message
   * @param handler - Optional callback for when users react to this message
   * @returns this for chaining
   */
  setReactions(emojis: string[], handler?: ReactionCallback): this {
    const toRemove = this.trackedEmojis.filter((e) => !emojis.includes(e));
    const toAdd = emojis.filter((e) => !this.trackedEmojis.includes(e));
    this.trackedEmojis = [...emojis];

    if (toRemove.length > 0) {
      this.removeReactions(toRemove);
    }
    if (toAdd.length > 0) {
      this.addReactions(toAdd);
    }

    this.offReaction();
    if (handler) {
      this.onReaction(handler);
    }

    return this;
  }

  /**
   * Reply in this message's thread
   * @param content - Reply content (string or Document)
   * @param files - Optional file attachments
   * @returns ReplyMessage that can be awaited to handle success/failure
   */
  reply(
    content: MessageContent,
    files?: FileAttachment[]
  ): Message & PromiseLike<Message> {
    const replyPromise = this.operations.reply(
      this.channelId,
      this.id,
      content,
      files
    );
    return new ReplyMessage(replyPromise, this.operations, this.platform);
  }

  /**
   * Stream replies to this message's thread by buffering text and
   * flushing it at a fixed interval. Long text is automatically
   * chunked to fit within platform message limits.
   * @param flushIntervalMs - How often to flush buffered text (in milliseconds)
   * @param abortSignal - Optional signal to automatically stop the stream when aborted
   * @returns StreamingReply with append/flush/stop methods
   */
  streamReply(
    flushIntervalMs: number,
    abortSignal?: AbortSignal
  ): StreamingReply {
    return new StreamingReply(
      (content) => this.reply(content),
      this.platform,
      flushIntervalMs,
      abortSignal
    );
  }

  /**
   * Create a thread from this message
   * @param name - Thread name
   * @param autoArchiveDuration - Auto-archive duration in minutes (60, 1440, 4320, 10080)
   * @returns Thread with post, onReply, and delete capabilities
   */
  async startThread(
    name: string,
    autoArchiveDuration?: number
  ): Promise<Thread> {
    return this.operations.startThread(
      this.id,
      this.channelId,
      name,
      autoArchiveDuration
    );
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
 *   const reply = await msg.reply('text');
 */
export class ReplyMessage extends Message implements PromiseLike<Message> {
  private replyPromise: Promise<MessageData>;
  private deferredReactionCallbacks: ReactionCallback[] = [];
  private resolved = false;

  constructor(
    replyPromise: Promise<MessageData>,
    operations: MessageOperations,
    platform: Platform
  ) {
    // Initialize with placeholder data
    super({ id: "", channelId: "", platform }, operations);
    this.replyPromise = replyPromise;

    // Update our data when the reply completes and subscribe any deferred listeners
    this.replyPromise
      .then((data) => {
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
   * Override addReactions to wait for reply to complete first
   */
  override addReactions(emojis: string[]): this {
    // Chain reactions after the reply completes, capturing current pendingReactions
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.replyPromise.then(
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
   * Override removeReactions to wait for reply to complete first
   */
  override removeReactions(emojis: string[]): this {
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.replyPromise.then(
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
   * Override removeAllReactions to wait for reply to complete first
   */
  override removeAllReactions(): this {
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.replyPromise.then(
      () => currentPendingReactions
    );
    this.pendingReactions = this.pendingReactions.then(() =>
      this.operations.removeAllReactions(this.id, this.channelId)
    );
    return this;
  }

  /**
   * Override onReaction to defer subscription until reply completes
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
   * Makes ReplyMessage directly awaitable.
   * Resolves to a plain Message (not thenable) to prevent infinite await loops.
   */
  then<TResult1 = Message, TResult2 = never>(
    onfulfilled?: ((value: Message) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const resolved = this.replyPromise.then(async () => {
      await this.pendingReactions;
      return this.toSnapshot();
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
